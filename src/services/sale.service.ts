import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/dtos/common/api.response.dto';
import { PagedResults } from 'src/dtos/common/paged.results.dto';
import { SaleFilter } from 'src/dtos/sale/sale.filter.dto';
import { SaleRequest } from 'src/dtos/sale/sale.request.dto';
import { SalesTrend } from 'src/dtos/sale/sales.trend.dto';
import { SalesTrendFilter } from 'src/dtos/sale/sales.trend.filter.dto';
import {
  LedgerSource,
  SalePaymentMethod,
  SaleStatus,
  SalesTrendGroupBy,
} from 'src/enums';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { PaymentSplit } from 'src/models/sale/payment-split.model';
import { SaleItem } from 'src/models/sale/sale-item.model';
import { CategoryRepository } from 'src/repositories/category.repository';
import { CounterRepository } from 'src/repositories/counter.repository';
import { InventoryRepository } from 'src/repositories/inventory.repository';
import { RoleRepository } from 'src/repositories/role.repository';
import { SaleRepository } from 'src/repositories/sale.repository';
import { ShopInventoryRepository } from 'src/repositories/shop-inventory.repository';
import { ShopRepository } from 'src/repositories/shop.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { Sale } from 'src/schemas/sale.schema';
import { Shop } from 'src/schemas/shop.schema';
import { Vendor } from 'src/schemas/vendor.schema';
import { LedgerEntryService } from 'src/services/ledger-entry.service';
import { PaymentTransactionService } from 'src/services/payment-transaction.service';
import { VendorService } from 'src/services/vendor.service';
import {
  resolveRequesterShopId,
  toInventoryInfo,
  toPaginationInfo,
  toShopInfo,
  toUserInfo,
  toVendorInfo,
} from 'src/utils';

@Injectable()
export class SaleService {
  private readonly logger = new Logger(SaleService.name);
  constructor(
    private readonly saleRepository: SaleRepository,
    private readonly shopRepository: ShopRepository,
    private readonly shopInventoryRepository: ShopInventoryRepository,
    private readonly inventoryRepository: InventoryRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly userRepository: UserRepository,
    private readonly roleRepository: RoleRepository,
    private readonly counterRepository: CounterRepository,
    private readonly ledgerEntryService: LedgerEntryService,
    private readonly vendorService: VendorService,
    private readonly paymentTransactionService: PaymentTransactionService,
  ) {}

  //get by id
  async getById(
    id: string,
    requesterId: string,
  ): Promise<ApiResponseDto<Sale>> {
    try {
      const sale = await this.saleRepository.getById(id);
      if (!sale) {
        return CommonResponses.NotFoundResponse<Sale>('Sale not found');
      }
      const shopId = await resolveRequesterShopId(
        requesterId,
        this.userRepository,
      );
      if (shopId && sale.shopId !== shopId) {
        return CommonResponses.NotFoundResponse<Sale>('Sale not found');
      }
      return CommonResponses.OkResponse<Sale>(sale);
    } catch (error) {
      this.logger.error(
        'an error occurred while getting sale by id',
        id,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<Sale>(
        'An error occurred while getting sale by id',
      );
    }
  }

  // Revenue (value1) and transaction count (value2), grouped by whichever
  // dimension the caller asks for - Hour/Day/Week/Month/Year bucket time
  // continuously (every bucket in range appears even with no sales, so a
  // chart has no gaps); Shop/Cashier are categorical, so only groups with
  // at least one sale are returned, ranked by revenue. Each grouping gets
  // its own sensible default range when the caller doesn't specify one, so
  // e.g. asking for "Hour" without a range gets the last 24 hours instead
  // of one bucket per hour across a whole default week.
  async getSalesTrend(
    filter: SalesTrendFilter,
    requesterId: string,
  ): Promise<ApiResponseDto<SalesTrend[]>> {
    try {
      const groupBy = filter?.groupBy ?? SalesTrendGroupBy.Day;
      const { start, end } = this.resolveTrendRange(filter, groupBy);
      const shopId = await resolveRequesterShopId(
        requesterId,
        this.userRepository,
      );

      const rows = await this.saleRepository.getTrend({
        ...filter,
        ...(shopId ? { shopId } : {}),
        groupBy,
        startDate: start,
        endDate: end,
      });

      if (
        groupBy === SalesTrendGroupBy.Shop ||
        groupBy === SalesTrendGroupBy.Cashier
      ) {
        const trend: SalesTrend[] = rows
          .slice()
          .sort((a, b) => b.value1 - a.value1)
          .map((row) => ({
            label: row.label,
            value1: row.value1,
            value2: row.value2,
          }));
        return CommonResponses.OkResponse<SalesTrend[]>(trend);
      }

      // Unlike Shop/Cashier, a sale item doesn't snapshot a category name -
      // the repository only returns a raw categoryId (or none, for an item
      // whose Inventory record no longer resolves), so this resolves names
      // in a batch the same way InventoryService.getStockBreakdown does.
      if (groupBy === SalesTrendGroupBy.Category) {
        const categories = await this.categoryRepository.getByIds(
          rows.map((row) => row.key).filter((key): key is string => !!key),
        );
        const categoryById = new Map(categories.map((c) => [c.id, c]));
        const trend: SalesTrend[] = rows
          .slice()
          .sort((a, b) => b.value1 - a.value1)
          .map((row) => ({
            label: categoryById.get(row.key)?.name ?? 'Uncategorized',
            value1: row.value1,
            value2: row.value2,
          }));
        return CommonResponses.OkResponse<SalesTrend[]>(trend);
      }

      const byKey = new Map(rows.map((row) => [row.key, row]));
      const trend: SalesTrend[] = [];
      const lastKey = this.trendBucketKey(end, groupBy);
      let cursor = this.startOfTrendBucket(start, groupBy);
      // Safety cap so an absurd range (e.g. Hour across several years)
      // can't build an unbounded response.
      for (let i = 0; i < 5000; i++) {
        const key = this.trendBucketKey(cursor, groupBy);
        const row = byKey.get(key);
        trend.push({
          label: key,
          value1: row?.value1 ?? 0,
          value2: row?.value2 ?? 0,
        });
        if (key === lastKey) break;
        cursor = this.advanceTrendBucket(cursor, groupBy);
      }

      return CommonResponses.OkResponse<SalesTrend[]>(trend);
    } catch (error) {
      this.logger.error(
        'an error occurred while getting sales trend',
        filter,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<SalesTrend[]>(
        'An error occurred while getting sales trend',
      );
    }
  }

  private resolveTrendRange(
    filter: SalesTrendFilter,
    groupBy: SalesTrendGroupBy,
  ): { start: Date; end: Date } {
    const end = filter?.endDate ? new Date(filter.endDate) : new Date();
    if (filter?.startDate) {
      return { start: new Date(filter.startDate), end };
    }

    const start = new Date(end);
    switch (groupBy) {
      case SalesTrendGroupBy.Hour:
        start.setUTCHours(start.getUTCHours() - 23, 0, 0, 0); // last 24 hours
        break;
      case SalesTrendGroupBy.Week:
        start.setUTCDate(start.getUTCDate() - 56); // last 8 weeks
        break;
      case SalesTrendGroupBy.Month:
        start.setUTCMonth(start.getUTCMonth() - 11); // last 12 months
        break;
      case SalesTrendGroupBy.Year:
        start.setUTCFullYear(start.getUTCFullYear() - 4); // last 5 years
        break;
      case SalesTrendGroupBy.Shop:
      case SalesTrendGroupBy.Cashier:
      case SalesTrendGroupBy.Category:
        start.setUTCDate(start.getUTCDate() - 29); // last 30 days
        break;
      case SalesTrendGroupBy.Day:
      default:
        start.setUTCDate(start.getUTCDate() - 6); // last 7 days
        break;
    }
    return { start, end };
  }

  private startOfTrendBucket(date: Date, groupBy: SalesTrendGroupBy): Date {
    const d = new Date(date);
    switch (groupBy) {
      case SalesTrendGroupBy.Hour:
        d.setUTCMinutes(0, 0, 0);
        return d;
      case SalesTrendGroupBy.Week: {
        const dayNum = (d.getUTCDay() + 6) % 7; // Monday = 0
        d.setUTCDate(d.getUTCDate() - dayNum);
        d.setUTCHours(0, 0, 0, 0);
        return d;
      }
      case SalesTrendGroupBy.Month:
        d.setUTCDate(1);
        d.setUTCHours(0, 0, 0, 0);
        return d;
      case SalesTrendGroupBy.Year:
        d.setUTCMonth(0, 1);
        d.setUTCHours(0, 0, 0, 0);
        return d;
      case SalesTrendGroupBy.Day:
      default:
        d.setUTCHours(0, 0, 0, 0);
        return d;
    }
  }

  private advanceTrendBucket(date: Date, groupBy: SalesTrendGroupBy): Date {
    const d = new Date(date);
    switch (groupBy) {
      case SalesTrendGroupBy.Hour:
        d.setUTCHours(d.getUTCHours() + 1);
        return d;
      case SalesTrendGroupBy.Week:
        d.setUTCDate(d.getUTCDate() + 7);
        return d;
      case SalesTrendGroupBy.Month:
        d.setUTCMonth(d.getUTCMonth() + 1);
        return d;
      case SalesTrendGroupBy.Year:
        d.setUTCFullYear(d.getUTCFullYear() + 1);
        return d;
      case SalesTrendGroupBy.Day:
      default:
        d.setUTCDate(d.getUTCDate() + 1);
        return d;
    }
  }

  //must match the $dateToString format used for the same groupBy in
  //SaleRepository.getTrend exactly, since this is how gap-filled buckets
  //are matched up against real aggregation results
  private trendBucketKey(date: Date, groupBy: SalesTrendGroupBy): string {
    switch (groupBy) {
      case SalesTrendGroupBy.Hour:
        return `${date.toISOString().slice(0, 13)}:00`;
      case SalesTrendGroupBy.Week:
        return this.isoWeekKey(date);
      case SalesTrendGroupBy.Month:
        return date.toISOString().slice(0, 7);
      case SalesTrendGroupBy.Year:
        return String(date.getUTCFullYear());
      case SalesTrendGroupBy.Day:
      default:
        return date.toISOString().slice(0, 10);
    }
  }

  //ISO 8601 week-numbering year + week, e.g. "2026-W38" - matches Mongo's
  //%G-%V format exactly, including the year-boundary edge case where the
  //first/last days of a calendar year belong to a week in the adjacent
  //ISO year.
  private isoWeekKey(date: Date): string {
    const d = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    const dayNum = (d.getUTCDay() + 6) % 7; // Monday = 0
    d.setUTCDate(d.getUTCDate() - dayNum + 3); // Thursday of this ISO week
    const isoYear = d.getUTCFullYear();
    const jan4 = new Date(Date.UTC(isoYear, 0, 4));
    const jan4DayNum = (jan4.getUTCDay() + 6) % 7;
    const week1Monday = new Date(jan4);
    week1Monday.setUTCDate(jan4.getUTCDate() - jan4DayNum);
    const weekNum =
      Math.round((d.getTime() - week1Monday.getTime()) / (7 * 86_400_000)) + 1;
    return `${isoYear}-W${String(weekNum).padStart(2, '0')}`;
  }

  //list, optionally scoped by shop/cashier/payment method/status
  async list(
    filter: SaleFilter,
    requesterId: string,
  ): Promise<ApiResponseDto<PagedResults<Sale>>> {
    try {
      const { page, pageSize } = toPaginationInfo(filter);
      const shopId = await resolveRequesterShopId(
        requesterId,
        this.userRepository,
      );
      const scoped = shopId ? { ...filter, shopId } : filter;
      const { results, totalCount } = await this.saleRepository.list(scoped);
      return CommonResponses.OkResponse<PagedResults<Sale>>({
        results,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error('an error occurred while listing sales', filter, error);
      return CommonResponses.InternalServerErrorResponse<PagedResults<Sale>>(
        'An error occurred while listing sales',
      );
    }
  }

  //ring up a sale: validates stock, deducts it, posts revenue to the
  //shop's ledger and records the sale - all atomically from the caller's
  //point of view (no pending state, unlike a Transfer)
  async create(
    request: SaleRequest,
    cashierId: string,
  ): Promise<ApiResponseDto<Sale>> {
    try {
      const shop = await this.shopRepository.getById(request.shopId);
      if (!shop) {
        return CommonResponses.NotFoundResponse<Sale>('Shop not found');
      }

      const ids = request.items.map((i) => i.inventoryId);
      if (new Set(ids).size !== ids.length) {
        return CommonResponses.BadRequestResponse<Sale>(
          undefined,
          'The same item appears more than once in this sale',
        );
      }

      const items: SaleItem[] = [];
      for (const line of request.items) {
        const inventory = await this.inventoryRepository.getById(
          line.inventoryId,
        );
        if (!inventory) {
          return CommonResponses.NotFoundResponse<Sale>(
            'One of the items in this sale no longer exists',
          );
        }

        const stock = await this.shopInventoryRepository.getByShopAndInventory(
          request.shopId,
          line.inventoryId,
        );
        if (!stock || stock.quantity < line.quantity) {
          return CommonResponses.BadRequestResponse<Sale>(
            undefined,
            `${inventory.name} doesn't have enough stock at this shop (have ${stock?.quantity ?? 0}, need ${line.quantity})`,
          );
        }

        const unitPrice = inventory.price;
        items.push({
          inventoryId: inventory.id,
          inventoryInfoSnapshot: toInventoryInfo(inventory),
          quantity: line.quantity,
          unitPrice,
          lineTotal: Math.round(unitPrice * line.quantity * 100) / 100,
        });
      }

      const subtotal =
        Math.round(items.reduce((sum, i) => sum + i.lineTotal, 0) * 100) / 100;
      const discount = Math.min(Math.max(request.discount ?? 0, 0), subtotal);
      const total = Math.round((subtotal - discount) * 100) / 100;

      const isCredit = request.paymentMethod === SalePaymentMethod.Credit;
      const isDigital = request.paymentMethod === SalePaymentMethod.Digital;
      const isSplit = request.paymentMethod === SalePaymentMethod.Split;
      // Split's only supported pairing is Cash + a Paystack (Digital) leg -
      // see the Split case below - so a valid Split, like pure Digital, is
      // never settled synchronously at creation time.
      const needsPaystack = isDigital || isSplit;
      let amountTendered: number | undefined;
      let changeGiven: number | undefined;
      let vendor: Vendor | undefined;
      let momoNetwork: string | undefined;
      let momoPhone: string | undefined;
      let payments: PaymentSplit[] | undefined;
      let paystackAmount: number | undefined;

      switch (request.paymentMethod) {
        case SalePaymentMethod.Credit: {
          if (!request.vendorId) {
            return CommonResponses.BadRequestResponse<Sale>(
              undefined,
              'A vendor is required for a credit sale',
            );
          }
          const check = await this.vendorService.assertCanSellOnCredit(
            request.vendorId,
          );
          if (check.status === 'error') {
            return CommonResponses.BadRequestResponse<Sale>(
              undefined,
              check.message,
            );
          }
          vendor = check.vendor;
          break;
        }
        case SalePaymentMethod.Cash: {
          if (
            request.amountTendered == null ||
            request.amountTendered < total
          ) {
            return CommonResponses.BadRequestResponse<Sale>(
              undefined,
              'The amount tendered is less than the total due',
            );
          }
          amountTendered = request.amountTendered;
          changeGiven = Math.round((amountTendered - total) * 100) / 100;
          break;
        }
        case SalePaymentMethod.MobileMoney: {
          if (!request.momoNetwork || !request.momoPhone) {
            return CommonResponses.BadRequestResponse<Sale>(
              undefined,
              'A mobile money network and phone number are required',
            );
          }
          momoNetwork = request.momoNetwork;
          momoPhone = request.momoPhone;
          break;
        }
        case SalePaymentMethod.Split: {
          // The only supported pairing: one Cash leg (settled immediately,
          // at the till) and one Digital leg (settled later via Paystack,
          // same as a pure-Digital sale - see needsPaystack above). The
          // buyer's momo number is collected on Paystack's own hosted
          // checkout, never typed by the cashier, so the Digital leg needs
          // no momoNetwork/momoPhone.
          const legs = request.payments ?? [];
          if (legs.length !== 2) {
            return CommonResponses.BadRequestResponse<Sale>(
              undefined,
              'A split sale needs exactly one cash leg and one mobile money leg',
            );
          }
          const cashLeg = legs.find((l) => l.method === SalePaymentMethod.Cash);
          const momoLeg = legs.find(
            (l) => l.method === SalePaymentMethod.Digital,
          );
          if (!cashLeg || !momoLeg) {
            return CommonResponses.BadRequestResponse<Sale>(
              undefined,
              'A split sale can only combine a cash leg and a mobile money leg',
            );
          }
          const legTotal =
            Math.round((cashLeg.amount + momoLeg.amount) * 100) / 100;
          if (legTotal !== total) {
            return CommonResponses.BadRequestResponse<Sale>(
              undefined,
              `The split amounts don't add up to the total due`,
            );
          }
          if (
            cashLeg.amountTendered == null ||
            cashLeg.amountTendered < cashLeg.amount
          ) {
            return CommonResponses.BadRequestResponse<Sale>(
              undefined,
              'The cash tendered is less than the cash portion of this split',
            );
          }
          if (!momoLeg.amount || momoLeg.amount <= 0) {
            return CommonResponses.BadRequestResponse<Sale>(
              undefined,
              'The mobile money portion of this split must be greater than zero',
            );
          }
          payments = [
            {
              method: SalePaymentMethod.Cash,
              amount: cashLeg.amount,
              amountTendered: cashLeg.amountTendered,
              changeGiven:
                Math.round((cashLeg.amountTendered - cashLeg.amount) * 100) /
                100,
              momoNetwork: null,
              momoPhone: null,
            },
            {
              method: SalePaymentMethod.Digital,
              amount: momoLeg.amount,
              amountTendered: null,
              changeGiven: null,
              momoNetwork: null,
              momoPhone: null,
            },
          ];
          paystackAmount = momoLeg.amount;
          break;
        }
        case SalePaymentMethod.Digital: {
          // Nothing to validate synchronously - payment happens after this
          // sale is created (see PaymentTransactionService), not now.
          break;
        }
      }

      const cashier = await this.userRepository.getById(cashierId);
      if (!cashier) {
        return CommonResponses.NotFoundResponse<Sale>('Cashier not found');
      }
      const cashierRole = cashier.roleId
        ? await this.roleRepository.getById(cashier.roleId)
        : null;

      const receiptNo = await this.generateReceiptNo(shop);

      for (const item of items) {
        await this.shopInventoryRepository.incrementQuantity(
          request.shopId,
          item.inventoryId,
          -item.quantity,
          item.inventoryInfoSnapshot,
        );
      }

      const sale = await this.saleRepository.create({
        shopId: request.shopId,
        shopInfoSnapshot: toShopInfo(shop),
        cashierId,
        cashierInfoSnapshot: toUserInfo(cashier, cashierRole?.name),
        receiptNo,
        items,
        subtotal,
        discount,
        total,
        paymentMethod: request.paymentMethod,
        isSplitSale: isSplit,
        status: needsPaystack ? SaleStatus.Pending : SaleStatus.Completed,
        amountTendered,
        changeGiven,
        vendorId: vendor?.id,
        vendorInfoSnapshot: vendor ? toVendorInfo(vendor) : undefined,
        momoNetwork,
        momoPhone,
        payments,
      });

      if (isCredit && vendor) {
        // No cash changed hands, so the shop's own cash ledger isn't
        // credited yet - only once the vendor actually pays (see
        // VendorService.recordPayment).
        await this.vendorService.postCharge(
          vendor,
          request.shopId,
          toShopInfo(shop),
          total,
          sale.id,
          request.vendorNote,
          request.vendorDueDate ? new Date(request.vendorDueDate) : undefined,
        );
      } else if (needsPaystack) {
        // For pure Digital, no cash changed hands yet. For a Split, the
        // cash leg *was* just collected at the till, but the ledger is only
        // ever credited once for the sale's full total (see
        // PaymentTransactionService.completeSale) - crediting it now, before
        // the momo leg is confirmed, would double-count if the sale later
        // has to be voided (cash refunded out-of-band by the cashier). The
        // sale sits Pending (stock already reserved above) until Paystack
        // confirms just the momo leg's amount. See initiateForSale, which
        // also releases the reservation immediately (void + restore stock,
        // for the WHOLE sale including the already-collected cash) if
        // Paystack can't be reached.
        const initiated = await this.paymentTransactionService.initiateForSale(
          sale,
          cashier.email,
          paystackAmount ?? total,
        );
        if (!initiated) {
          return CommonResponses.BadRequestResponse<Sale>(
            undefined,
            'Could not start the mobile money payment - please try again',
          );
        }
      } else {
        await this.ledgerEntryService.credit(
          request.shopId,
          total,
          LedgerSource.Sale,
          {
            referenceId: sale.id,
            description: `Sale ${receiptNo}`,
            recordedById: cashierId,
          },
        );
      }

      return CommonResponses.CreatedResponse<Sale>(sale);
    } catch (error) {
      this.logger.error(
        'an error occurred while creating sale',
        request,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<Sale>(
        'An error occurred while creating sale',
      );
    }
  }

  //e.g. "MAD-000123" - prefers the shop's saved receiptPrefix, otherwise
  //falls back to a readable prefix derived from its name; gapless per shop
  private async generateReceiptNo(shop: Shop): Promise<string> {
    const prefix =
      shop.receiptPrefix?.toUpperCase() ||
      shop.name
        .replace(/[^A-Za-z]/g, '')
        .slice(0, 3)
        .toUpperCase() ||
      'SHP';
    const seq = await this.counterRepository.next(`sale:${shop.id}`);
    return `${prefix}-${String(seq).padStart(6, '0')}`;
  }
}
