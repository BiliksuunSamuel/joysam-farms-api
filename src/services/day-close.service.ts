import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/dtos/common/api.response.dto';
import { PagedResults } from 'src/dtos/common/paged.results.dto';
import { DayCloseFilter } from 'src/dtos/day-close/day-close.filter.dto';
import { DayCloseRequest } from 'src/dtos/day-close/day-close.request.dto';
import {
  CANCELLATION_FEE_NOTE_PREFIX,
  SaleKind,
  SalePaymentMethod,
  SaleStatus,
} from 'src/enums';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { DayCloseRepository } from 'src/repositories/day-close.repository';
import { RoleRepository } from 'src/repositories/role.repository';
import { SaleRepository } from 'src/repositories/sale.repository';
import { ShopRepository } from 'src/repositories/shop.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { DayClose, DayCloseFigures } from 'src/schemas/day-close.schema';
import { Sale } from 'src/schemas/sale.schema';
import {
  resolveRequesterShopId,
  startOfUTCDay,
  toPaginationInfo,
  toShopInfo,
  toUserInfo,
} from 'src/utils';

const round2 = (n: number) => Math.round(n * 100) / 100;
const DAY_MS = 24 * 60 * 60 * 1000;
const todayKey = () => new Date().toISOString().slice(0, 10);

// Per shop, the cashiers who handled money on a day and whether each has
// closed. A shop with no activity has no row - there was nothing to close.
export type DayCloseStatusRow = {
  shopId: string;
  cashiers: { id: string; name: string; closed: boolean }[];
};

export type DayClosePreview = {
  date: string;
  shopId: string;
  shopName: string;
  figures: DayCloseFigures;
  // The close already made for this day, if any - closing again replaces it.
  existing: DayClose | null;
};

@Injectable()
export class DayCloseService {
  private readonly logger = new Logger(DayCloseService.name);
  constructor(
    private readonly dayCloseRepository: DayCloseRepository,
    private readonly saleRepository: SaleRepository,
    private readonly shopRepository: ShopRepository,
    private readonly userRepository: UserRepository,
    private readonly roleRepository: RoleRepository,
  ) {}

  // Adds up one cashier's records for a day. Money that counts is what was
  // actually received: cash sales, manual mobile money, debt collections and
  // instalment payments. Paystack (Digital) is reported but never expected
  // in the till, and credit sales move no money.
  private figuresFor(sales: Sale[], cancelled: Sale[] = []): DayCloseFigures {
    const f: DayCloseFigures = {
      salesCash: 0,
      salesMomo: 0,
      salesDigital: 0,
      salesCredit: 0,
      salesCount: 0,
      debtsCash: 0,
      debtsMomo: 0,
      debtCount: 0,
      instalmentsCash: 0,
      instalmentsMomo: 0,
      instalmentCount: 0,
      voidedCount: 0,
      voidedTotal: 0,
      refundsCash: 0,
      refundsMomo: 0,
      refundCount: 0,
      expectedCash: 0,
      expectedMomo: 0,
    };

    for (const sale of sales) {
      const kind = sale.kind ?? SaleKind.Sale;
      // A payment taken towards a plan that was later cancelled is voided, but
      // the money really did come in that day - the refund is counted as its
      // own cash going out - so it still counts as received.
      const cancelledPlanPayment =
        kind === SaleKind.InstalmentPayment &&
        sale.status === SaleStatus.Voided;
      if (sale.status === SaleStatus.Voided && !cancelledPlanPayment) {
        // A voided sale is money that never stayed (or was handed back).
        if (kind === SaleKind.Sale) {
          f.voidedCount += 1;
          f.voidedTotal += sale.total;
        }
        continue;
      }
      // Pending Paystack sales and the parent record of an instalment plan
      // hold no money of their own (the plan's payments are separate records).
      if (sale.status !== SaleStatus.Completed && !cancelledPlanPayment) continue;
      // The record of a cancelled plan's kept fee is revenue bookkeeping: no
      // money came in with it.
      if (
        kind === SaleKind.InstalmentPayment &&
        sale.note?.startsWith(CANCELLATION_FEE_NOTE_PREFIX)
      ) {
        continue;
      }

      const add = (method: SalePaymentMethod, amount: number) => {
        const isCash = method === SalePaymentMethod.Cash;
        const isMomo = method === SalePaymentMethod.MobileMoney;
        if (kind === SaleKind.DebtPayment) {
          if (isCash) f.debtsCash += amount;
          else if (isMomo) f.debtsMomo += amount;
        } else if (kind === SaleKind.InstalmentPayment) {
          if (isCash) f.instalmentsCash += amount;
          else if (isMomo) f.instalmentsMomo += amount;
        } else if (isCash) f.salesCash += amount;
        else if (isMomo) f.salesMomo += amount;
        else if (method === SalePaymentMethod.Digital) f.salesDigital += amount;
        else if (method === SalePaymentMethod.Credit) f.salesCredit += amount;
      };

      if (kind === SaleKind.DebtPayment) f.debtCount += 1;
      else if (kind === SaleKind.InstalmentPayment) f.instalmentCount += 1;
      else f.salesCount += 1;

      if (sale.paymentMethod === SalePaymentMethod.Split) {
        for (const leg of sale.payments ?? []) add(leg.method, leg.amount);
      } else {
        add(sale.paymentMethod, sale.total);
      }
    }

    // Refunds for plans this cashier cancelled went back out - from the till
    // or the business mobile money account, by how they were paid.
    for (const plan of cancelled) {
      const refund = plan.instalment?.refundedAmount ?? 0;
      if (refund > 0) {
        // Plans cancelled before the method was recorded were paid in cash.
        if (plan.instalment?.refundMethod === SalePaymentMethod.MobileMoney) {
          f.refundsMomo += refund;
        } else {
          f.refundsCash += refund;
        }
        f.refundCount += 1;
      }
    }

    for (const key of Object.keys(f) as (keyof DayCloseFigures)[]) {
      f[key] = round2(f[key]);
    }
    f.expectedCash = round2(
      f.salesCash + f.debtsCash + f.instalmentsCash - f.refundsCash,
    );
    f.expectedMomo = round2(
      f.salesMomo + f.debtsMomo + f.instalmentsMomo - f.refundsMomo,
    );
    return f;
  }

  private async resolveShop(requesterId: string, requestedShopId?: string) {
    const scoped = await resolveRequesterShopId(
      requesterId,
      this.userRepository,
    );
    const shopId = scoped ?? requestedShopId;
    if (!shopId) return null;
    return await this.shopRepository.getById(shopId);
  }

  private validDate(date?: string): string | null {
    const key = date ? date.slice(0, 10) : todayKey();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
    if (key > todayKey()) return null; // a day that has not happened yet
    return key;
  }

  private async figuresForDay(shopId: string, cashierId: string, date: string) {
    const start = startOfUTCDay(new Date(`${date}T00:00:00Z`));
    const end = new Date(start.getTime() + DAY_MS);
    const [sales, cancelled] = await Promise.all([
      this.saleRepository.listForCashierBetween(shopId, cashierId, start, end),
      this.saleRepository.listCancelledBy(shopId, cashierId, start, end),
    ]);
    return this.figuresFor(sales, cancelled);
  }

  async preview(
    requesterId: string,
    shopId?: string,
    date?: string,
  ): Promise<ApiResponseDto<DayClosePreview>> {
    try {
      const day = this.validDate(date);
      if (!day) {
        return CommonResponses.BadRequestResponse<DayClosePreview>(
          undefined,
          'Choose today or an earlier day',
        );
      }
      const shop = await this.resolveShop(requesterId, shopId);
      if (!shop) {
        return CommonResponses.NotFoundResponse<DayClosePreview>(
          'Shop not found',
        );
      }
      const [figures, existing] = await Promise.all([
        this.figuresForDay(shop.id, requesterId, day),
        this.dayCloseRepository.getForDay(shop.id, requesterId, day),
      ]);
      return CommonResponses.OkResponse<DayClosePreview>({
        date: day,
        shopId: shop.id,
        shopName: shop.name,
        figures,
        existing,
      });
    } catch (error) {
      this.logger.error('an error occurred while preparing a day close', error);
      return CommonResponses.InternalServerErrorResponse<DayClosePreview>(
        'An error occurred while preparing the day close',
      );
    }
  }

  async close(
    request: DayCloseRequest,
    requesterId: string,
  ): Promise<ApiResponseDto<DayClose>> {
    try {
      const day = this.validDate(request.date);
      if (!day) {
        return CommonResponses.BadRequestResponse<DayClose>(
          undefined,
          'Choose today or an earlier day',
        );
      }
      const shop = await this.resolveShop(requesterId, request.shopId);
      if (!shop) {
        return CommonResponses.NotFoundResponse<DayClose>('Shop not found');
      }
      const cashier = await this.userRepository.getById(requesterId);
      if (!cashier) {
        return CommonResponses.NotFoundResponse<DayClose>('Cashier not found');
      }
      const role = cashier.roleId
        ? await this.roleRepository.getById(cashier.roleId)
        : null;

      // The expected figures are always recomputed here, never taken from
      // the client - what the system expected is part of the record.
      const figures = await this.figuresForDay(shop.id, requesterId, day);
      const cashDifference = round2(request.countedCash - figures.expectedCash);
      const momoDifference = round2(request.countedMomo - figures.expectedMomo);
      const reason = request.reason?.trim() || null;
      if ((cashDifference !== 0 || momoDifference !== 0) && !reason) {
        return CommonResponses.BadRequestResponse<DayClose>(
          undefined,
          'Say why the count differs from what the system expected',
        );
      }

      const saved = await this.dayCloseRepository.upsert(
        shop.id,
        requesterId,
        day,
        {
          shopId: shop.id,
          shopInfoSnapshot: toShopInfo(shop),
          cashierId: requesterId,
          cashierInfoSnapshot: toUserInfo(cashier, role?.name),
          date: day,
          figures,
          countedCash: round2(request.countedCash),
          countedMomo: round2(request.countedMomo),
          cashDifference,
          momoDifference,
          reason,
          note: request.note?.trim() || null,
        },
      );
      return CommonResponses.OkResponse<DayClose>(saved);
    } catch (error) {
      this.logger.error('an error occurred while closing a day', request, error);
      return CommonResponses.InternalServerErrorResponse<DayClose>(
        'An error occurred while closing the day',
      );
    }
  }

  // Who may see what: anyone who can close their own day sees their own
  // closes; `dayclose.view` (or full access) also sees the other cashiers'
  // at the shop. Neither means no access.
  private async access(requesterId: string) {
    const user = await this.userRepository.getById(requesterId);
    if (!user) return null;
    const all =
      user.allPermissions || (user.permissionKeys ?? []).includes('dayclose.view');
    const own =
      user.allPermissions || (user.permissionKeys ?? []).includes('dayclose.create');
    return all || own ? { all } : null;
  }

  async list(
    filter: DayCloseFilter,
    requesterId: string,
  ): Promise<ApiResponseDto<PagedResults<DayClose>>> {
    try {
      const access = await this.access(requesterId);
      if (!access) {
        return CommonResponses.ForbiddenResponse<PagedResults<DayClose>>(
          'You do not have access to day closes',
        );
      }
      const { page, pageSize } = toPaginationInfo(filter);
      const shopId = await resolveRequesterShopId(
        requesterId,
        this.userRepository,
      );
      const scoped: DayCloseFilter = {
        ...filter,
        ...(shopId ? { shopId } : {}),
        ...(access.all ? {} : { cashierId: requesterId }),
      };
      const { results, totalCount } = await this.dayCloseRepository.list(scoped);
      return CommonResponses.OkResponse<PagedResults<DayClose>>({
        results,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error('an error occurred while listing day closes', error);
      return CommonResponses.InternalServerErrorResponse<PagedResults<DayClose>>(
        'An error occurred while listing day closes',
      );
    }
  }

  // Which cashiers still have to close, shop by shop - what the dashboard's
  // "days closed" is built from. Needs the view permission: it names other
  // cashiers.
  async status(
    requesterId: string,
    date?: string,
  ): Promise<ApiResponseDto<DayCloseStatusRow[]>> {
    try {
      const access = await this.access(requesterId);
      if (!access?.all) {
        return CommonResponses.ForbiddenResponse<DayCloseStatusRow[]>(
          'You do not have access to day closes',
        );
      }
      const day = this.validDate(date);
      if (!day) {
        return CommonResponses.BadRequestResponse<DayCloseStatusRow[]>(
          undefined,
          'Choose today or an earlier day',
        );
      }
      const shopId = await resolveRequesterShopId(
        requesterId,
        this.userRepository,
      );
      const start = startOfUTCDay(new Date(`${day}T00:00:00Z`));
      const [activity, closes] = await Promise.all([
        this.saleRepository.listActivityBetween(
          start,
          new Date(start.getTime() + DAY_MS),
          shopId ?? undefined,
        ),
        this.dayCloseRepository.list({
          ...(shopId ? { shopId } : {}),
          startDate: start,
          endDate: start,
          page: 1,
          pageSize: 1000,
        } as DayCloseFilter),
      ]);
      // When each cashier last closed: a sale or collection after that moment
      // means they have more to count, so they show as open again.
      const closedAt = new Map<string, number>();
      for (const c of closes.results) {
        closedAt.set(
          `${c.shopId}:${c.cashierId}`,
          new Date(c.updatedAt ?? c.createdAt).getTime(),
        );
      }

      const byShop = new Map<
        string,
        Map<string, { name: string; lastActivity: number }>
      >();
      for (const a of activity) {
        const cashiers = byShop.get(a.shopId) ?? new Map();
        const at = new Date(a.createdAt).getTime();
        const seen = cashiers.get(a.cashierId);
        cashiers.set(a.cashierId, {
          name: a.cashierInfoSnapshot?.name ?? 'Cashier',
          lastActivity: Math.max(seen?.lastActivity ?? 0, at),
        });
        byShop.set(a.shopId, cashiers);
      }
      const rows: DayCloseStatusRow[] = [...byShop.entries()].map(
        ([shop, cashiers]) => ({
          shopId: shop,
          cashiers: [...cashiers.entries()].map(([id, c]) => ({
            id,
            name: c.name,
            closed: (closedAt.get(`${shop}:${id}`) ?? 0) >= c.lastActivity,
          })),
        }),
      );
      return CommonResponses.OkResponse<DayCloseStatusRow[]>(rows);
    } catch (error) {
      this.logger.error('an error occurred while reading day close status', error);
      return CommonResponses.InternalServerErrorResponse<DayCloseStatusRow[]>(
        'An error occurred while reading the day close status',
      );
    }
  }

  async getById(
    id: string,
    requesterId: string,
  ): Promise<ApiResponseDto<DayClose>> {
    try {
      const access = await this.access(requesterId);
      const close = access ? await this.dayCloseRepository.getById(id) : null;
      const shopId = await resolveRequesterShopId(
        requesterId,
        this.userRepository,
      );
      if (
        !access ||
        !close ||
        (shopId && close.shopId !== shopId) ||
        (!access.all && close.cashierId !== requesterId)
      ) {
        return CommonResponses.NotFoundResponse<DayClose>('Day close not found');
      }
      return CommonResponses.OkResponse<DayClose>(close);
    } catch (error) {
      this.logger.error('an error occurred while getting a day close', error);
      return CommonResponses.InternalServerErrorResponse<DayClose>(
        'An error occurred while getting the day close',
      );
    }
  }
}
