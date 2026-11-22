import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/dtos/common/api.response.dto';
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import { PagedResults } from 'src/dtos/common/paged.results.dto';
import {
  InstalmentCancelRequest,
  InstalmentPaymentRequest,
} from 'src/dtos/instalment/instalment-payment.request.dto';
import { SaleRequest } from 'src/dtos/sale/sale.request.dto';
import {
  CANCELLATION_FEE_NOTE_PREFIX,
  InstalmentFrequency,
  InstalmentStatus,
  LedgerSource,
  SaleKind,
  SalePaymentMethod,
  SaleStatus,
} from 'src/enums';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { CounterRepository } from 'src/repositories/counter.repository';
import { InstalmentPlanRepository } from 'src/repositories/instalment-plan.repository';
import { RoleRepository } from 'src/repositories/role.repository';
import { SaleRepository } from 'src/repositories/sale.repository';
import { ShopInventoryRepository } from 'src/repositories/shop-inventory.repository';
import { ShopRepository } from 'src/repositories/shop.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { Sale } from 'src/schemas/sale.schema';
import { LedgerEntryService } from 'src/services/ledger-entry.service';
import { SaleProfitService } from 'src/services/sale-profit.service';
import {
  buildReceiptNo,
  resolveRequesterShopId,
  toCustomerInfo,
  toPaginationInfo,
  toShopInfo,
  toUserInfo,
} from 'src/utils';

const round2 = (n: number) => Math.round(n * 100) / 100;

type Instalment = NonNullable<Sale['instalment']>;

// Sales paid for over time. The goods are reserved (stock deducted) from the
// start and handed over only once the last payment clears; revenue is
// recognised as money arrives (each payment is its own SaleKind.
// InstalmentPayment record), never for the instalment sale itself.
@Injectable()
export class InstalmentSaleService {
  private readonly logger = new Logger(InstalmentSaleService.name);

  constructor(
    private readonly saleRepository: SaleRepository,
    private readonly planRepository: InstalmentPlanRepository,
    private readonly shopRepository: ShopRepository,
    private readonly shopInventoryRepository: ShopInventoryRepository,
    private readonly counterRepository: CounterRepository,
    private readonly ledgerEntryService: LedgerEntryService,
    private readonly saleProfitService: SaleProfitService,
    private readonly userRepository: UserRepository,
    private readonly roleRepository: RoleRepository,
  ) {}

  // Deposit first (due now), then equal instalments one period apart; the
  // last one absorbs any rounding so the schedule always adds up exactly.
  private buildSchedule(
    totalDue: number,
    plan: {
      instalmentCount: number;
      frequency: InstalmentFrequency;
      depositPercent: number;
    },
    from: Date,
  ): Instalment['schedule'] {
    const deposit = round2((totalDue * (plan.depositPercent ?? 0)) / 100);
    const balance = round2(totalDue - deposit);
    const each = round2(balance / plan.instalmentCount);
    const schedule: Instalment['schedule'] = [];
    if (deposit > 0) {
      schedule.push({
        number: 0,
        dueDate: from,
        amount: deposit,
        paidAmount: 0,
        paidAt: null,
      });
    }
    let allocated = 0;
    for (let n = 1; n <= plan.instalmentCount; n++) {
      const due = new Date(from);
      if (plan.frequency === InstalmentFrequency.Weekly) {
        due.setDate(due.getDate() + 7 * n);
      } else {
        due.setMonth(due.getMonth() + n);
      }
      const amount =
        n === plan.instalmentCount ? round2(balance - allocated) : each;
      allocated = round2(allocated + amount);
      schedule.push({
        number: n,
        dueDate: due,
        amount,
        paidAmount: 0,
        paidAt: null,
      });
    }
    return schedule;
  }

  // Called by SaleService.create once it has resolved lines, totals, the
  // customer and the cashier - everything except taking money.
  async start(input: {
    request: SaleRequest;
    shop: { id: string; name: string } & Record<string, any>;
    cashier: any;
    cashierRoleName?: string;
    customer: any;
    items: Sale['items'];
    serviceItems: Sale['serviceItems'];
    goodsCost: number;
    subtotal: number;
    discount: number;
    total: number;
  }): Promise<ApiResponseDto<Sale>> {
    const { request, shop, total } = input;
    const plan = await this.planRepository.getById(request.instalmentPlanId);
    if (!plan || plan.active === false) {
      return CommonResponses.BadRequestResponse<Sale>(
        undefined,
        'That instalment plan is not available',
      );
    }
    if (
      request.paymentMethod !== SalePaymentMethod.Cash &&
      request.paymentMethod !== SalePaymentMethod.MobileMoney
    ) {
      return CommonResponses.BadRequestResponse<Sale>(
        undefined,
        'An instalment deposit can only be paid in cash or mobile money',
      );
    }

    const feeAmount = round2((total * (plan.feePercent ?? 0)) / 100);
    const totalDue = round2(total + feeAmount);
    const schedule = this.buildSchedule(totalDue, plan, new Date());
    const deposit = schedule[0]?.number === 0 ? schedule[0].amount : 0;

    if (deposit > 0) {
      if (
        request.paymentMethod === SalePaymentMethod.Cash &&
        (request.amountTendered == null || request.amountTendered < deposit)
      ) {
        return CommonResponses.BadRequestResponse<Sale>(
          undefined,
          `The amount tendered is less than the deposit due (${deposit.toFixed(2)})`,
        );
      }
      if (
        request.paymentMethod === SalePaymentMethod.MobileMoney &&
        (!request.momoNetwork || !request.momoPhone)
      ) {
        return CommonResponses.BadRequestResponse<Sale>(
          undefined,
          'A mobile money network and phone number are required for the deposit',
        );
      }
    }

    // Reserve the goods for this buyer.
    for (const item of input.items) {
      await this.shopInventoryRepository.incrementQuantity(
        shop.id,
        item.inventoryId,
        -item.quantity,
        item.inventoryInfoSnapshot,
      );
    }

    const seq = await this.counterRepository.next(`sale:${shop.id}`);
    const parent = await this.saleRepository.create({
      shopId: shop.id,
      shopInfoSnapshot: toShopInfo(shop),
      cashierId: input.cashier.id,
      cashierInfoSnapshot: toUserInfo(input.cashier, input.cashierRoleName),
      receiptNo: buildReceiptNo(shop as any, seq),
      items: input.items,
      serviceItems: input.serviceItems,
      subtotal: input.subtotal,
      discount: input.discount,
      total,
      paymentMethod: request.paymentMethod,
      isSplitSale: false,
      status: SaleStatus.Instalment,
      customerId: input.customer.id,
      customerInfoSnapshot: toCustomerInfo(input.customer),
      note: request.note || undefined,
      instalment: {
        planId: plan.id,
        planName: plan.name,
        frequency: plan.frequency,
        instalmentCount: plan.instalmentCount,
        depositPercent: plan.depositPercent ?? 0,
        feePercent: plan.feePercent ?? 0,
        cancellationFeePercent: plan.cancellationFeePercent ?? 0,
        totalDue,
        feeAmount,
        goodsCost: input.goodsCost,
        paidTotal: 0,
        status: InstalmentStatus.Active,
        schedule,
      },
    });

    if (deposit > 0) {
      const paid = await this.applyPayment(parent, {
        amount: deposit,
        method: request.paymentMethod,
        shop,
        cashier: input.cashier,
        cashierRoleName: input.cashierRoleName,
        amountTendered: request.amountTendered,
        momoNetwork: request.momoNetwork,
        momoPhone: request.momoPhone,
      });
      if ('error' in paid) {
        return CommonResponses.InternalServerErrorResponse<Sale>(paid.error);
      }
      return CommonResponses.CreatedResponse<Sale>(paid.sale);
    }
    return CommonResponses.CreatedResponse<Sale>(parent);
  }

  // Spreads `amount` over the schedule in order, then records the payment
  // as its own sale (revenue), credits the receiving shop's cash and books
  // the matching share of profit.
  private async applyPayment(
    parent: Sale,
    p: {
      amount: number;
      method: SalePaymentMethod;
      shop: any;
      cashier: any;
      cashierRoleName?: string;
      amountTendered?: number;
      momoNetwork?: string;
      momoPhone?: string;
    },
  ): Promise<{ sale: Sale; payment: Sale } | { error: string }> {
    const inst = parent.instalment;
    const amount = round2(p.amount);
    const now = new Date();
    let remaining = amount;
    const schedule = inst.schedule.map((s) => ({ ...s }));
    for (const entry of schedule) {
      if (remaining <= 0) break;
      const open = round2(entry.amount - entry.paidAmount);
      if (open <= 0) continue;
      const apply = Math.min(open, remaining);
      entry.paidAmount = round2(entry.paidAmount + apply);
      if (entry.paidAmount >= entry.amount - 0.005) entry.paidAt = now;
      remaining = round2(remaining - apply);
    }
    const paidTotal = round2(inst.paidTotal + amount);
    const next: Instalment = {
      ...inst,
      schedule,
      paidTotal,
      status:
        paidTotal >= inst.totalDue - 0.005
          ? InstalmentStatus.Paid
          : InstalmentStatus.Active,
    };
    const updated = await this.saleRepository.updateInstalment(
      parent.id,
      inst.paidTotal,
      next,
    );
    if (!updated) {
      return { error: 'This plan was just updated by someone else - please reload and try again' };
    }

    const seq = await this.counterRepository.next(`sale:${p.shop.id}`);
    const payment = await this.saleRepository.create({
      shopId: p.shop.id,
      shopInfoSnapshot: toShopInfo(p.shop),
      cashierId: p.cashier.id,
      cashierInfoSnapshot: toUserInfo(p.cashier, p.cashierRoleName),
      receiptNo: buildReceiptNo(p.shop, seq),
      items: [],
      serviceItems: [],
      subtotal: amount,
      discount: 0,
      total: amount,
      paymentMethod: p.method,
      isSplitSale: false,
      status: SaleStatus.Completed,
      amountTendered:
        p.method === SalePaymentMethod.Cash ? p.amountTendered : undefined,
      changeGiven:
        p.method === SalePaymentMethod.Cash && p.amountTendered != null
          ? round2(p.amountTendered - amount)
          : undefined,
      momoNetwork: p.momoNetwork,
      momoPhone: p.momoPhone,
      customerId: parent.customerId,
      customerInfoSnapshot: parent.customerInfoSnapshot,
      note: `Instalment payment for ${parent.receiptNo}`,
      kind: SaleKind.InstalmentPayment,
      parentSaleId: parent.id,
    });

    await this.ledgerEntryService.credit(
      p.shop.id,
      amount,
      LedgerSource.Sale,
      {
        referenceId: payment.id,
        description: `Instalment payment ${payment.receiptNo} for ${parent.receiptNo}`,
        recordedById: p.cashier.id,
      },
    );

    const cost = round2((inst.goodsCost * amount) / inst.totalDue);
    await this.saleProfitService.record({
      saleId: payment.id,
      shopId: p.shop.id,
      date: payment.createdAt,
      items: [],
      revenue: amount,
      cost,
      profit: round2(amount - cost),
    });

    return { sale: updated, payment };
  }

  // Cross-shop by design: a buyer can pay at any shop, so the cashier must be
  // able to find the plan from another shop. A shop-scoped user has to
  // search (receipt number, customer name or phone) - an empty search only
  // shows their own shop's.
  async list(
    filter: BaseFilter & { status?: InstalmentStatus },
    requesterId: string,
  ): Promise<ApiResponseDto<PagedResults<Sale>>> {
    try {
      const { page, pageSize } = toPaginationInfo(filter);
      const shopId = await resolveRequesterShopId(requesterId, this.userRepository);
      const scoped = shopId && !filter?.query?.trim();
      const { results, totalCount } =
        await this.saleRepository.listInstalments({
          ...filter,
          shopId: scoped ? shopId : undefined,
        });
      return CommonResponses.OkResponse<PagedResults<Sale>>({
        results,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error('an error occurred while listing instalment sales', filter, error);
      return CommonResponses.InternalServerErrorResponse<PagedResults<Sale>>(
        'An error occurred while listing instalment sales',
      );
    }
  }

  // One plan with the payments taken towards it. Not scoped to a shop: a
  // buyer can pay at any shop, so any shop's staff with sale.view may open it
  // (the list is already reachable across shops by search).
  async detail(
    id: string,
  ): Promise<ApiResponseDto<{ sale: Sale; payments: Sale[] }>> {
    try {
      const sale = await this.saleRepository.getById(id);
      if (!sale || !sale.instalment) {
        return CommonResponses.NotFoundResponse<{ sale: Sale; payments: Sale[] }>(
          'Instalment sale not found',
        );
      }
      const payments = await this.saleRepository.listInstalmentPayments(id);
      return CommonResponses.OkResponse({ sale, payments });
    } catch (error) {
      this.logger.error('an error occurred while loading an instalment sale', { id }, error);
      return CommonResponses.InternalServerErrorResponse<{ sale: Sale; payments: Sale[] }>(
        'An error occurred while loading the instalment sale',
      );
    }
  }

  async recordPayment(
    id: string,
    request: InstalmentPaymentRequest,
    cashierId: string,
  ): Promise<ApiResponseDto<Sale>> {
    try {
      const parent = await this.saleRepository.getById(id);
      if (!parent?.instalment || parent.status !== SaleStatus.Instalment) {
        return CommonResponses.NotFoundResponse<Sale>('Instalment sale not found');
      }
      if (parent.instalment.status !== InstalmentStatus.Active) {
        return CommonResponses.BadRequestResponse<Sale>(
          undefined,
          'This plan has nothing left to pay',
        );
      }
      const ownShop = await resolveRequesterShopId(cashierId, this.userRepository);
      if (ownShop && ownShop !== request.shopId) {
        return CommonResponses.ForbiddenResponse<Sale>(
          'You can only take payments at your own shop',
        );
      }
      const shop = await this.shopRepository.getById(request.shopId);
      if (!shop) return CommonResponses.NotFoundResponse<Sale>('Shop not found');
      const outstanding = round2(
        parent.instalment.totalDue - parent.instalment.paidTotal,
      );
      if (request.amount > outstanding + 0.005) {
        return CommonResponses.BadRequestResponse<Sale>(
          undefined,
          `That is more than is owed (${outstanding.toFixed(2)})`,
        );
      }
      if (
        request.method === SalePaymentMethod.Cash &&
        request.amountTendered != null &&
        request.amountTendered < request.amount
      ) {
        return CommonResponses.BadRequestResponse<Sale>(
          undefined,
          'The amount tendered is less than the payment',
        );
      }
      if (
        request.method === SalePaymentMethod.MobileMoney &&
        (!request.momoNetwork || !request.momoPhone)
      ) {
        return CommonResponses.BadRequestResponse<Sale>(
          undefined,
          'A mobile money network and phone number are required',
        );
      }

      const cashier = await this.userRepository.getById(cashierId);
      const role = cashier?.roleId
        ? await this.roleRepository.getById(cashier.roleId)
        : null;
      const paid = await this.applyPayment(parent, {
        amount: request.amount,
        method: request.method,
        shop,
        cashier,
        cashierRoleName: role?.name,
        amountTendered: request.amountTendered,
        momoNetwork: request.momoNetwork,
        momoPhone: request.momoPhone,
      });
      if ('error' in paid) {
        return CommonResponses.ConflictResponse<Sale>(paid.error);
      }
      // The new payment's own receipt rides along as the response's latest
      // payment so the client can offer it straight away.
      return CommonResponses.OkResponse<Sale>(paid.sale);
    } catch (error) {
      this.logger.error('an error occurred while recording an instalment payment', { id, request }, error);
      return CommonResponses.InternalServerErrorResponse<Sale>(
        'An error occurred while recording the payment',
      );
    }
  }

  // Fully paid -> goods handed to the buyer.
  async release(id: string, userId: string): Promise<ApiResponseDto<Sale>> {
    try {
      const parent = await this.saleRepository.getById(id);
      if (!parent?.instalment) {
        return CommonResponses.NotFoundResponse<Sale>('Instalment sale not found');
      }
      const updated = await this.saleRepository.finishInstalment(
        id,
        [InstalmentStatus.Paid],
        {
          ...parent.instalment,
          status: InstalmentStatus.Released,
          releasedAt: new Date(),
          releasedById: userId,
        },
        SaleStatus.Instalment,
      );
      if (!updated) {
        return CommonResponses.ConflictResponse<Sale>(
          'The goods can only be released once the plan is fully paid',
        );
      }
      return CommonResponses.OkResponse<Sale>(updated);
    } catch (error) {
      this.logger.error('an error occurred while releasing an instalment sale', id, error);
      return CommonResponses.InternalServerErrorResponse<Sale>(
        'An error occurred while releasing the goods',
      );
    }
  }

  // Cancel before release: the stock goes back on the shelf, the buyer is
  // refunded what they paid less the plan's cancellation fee, and the
  // payments' revenue is reversed (the fee kept is recorded as its own
  // revenue). Everything is on the audit trail via the controller's @AuditLog.
  async cancel(
    id: string,
    request: InstalmentCancelRequest,
    userId: string,
  ): Promise<ApiResponseDto<Sale>> {
    try {
      const parent = await this.saleRepository.getById(id);
      if (!parent?.instalment) {
        return CommonResponses.NotFoundResponse<Sale>('Instalment sale not found');
      }
      const inst = parent.instalment;
      const paid = inst.paidTotal;
      const retained = round2((paid * inst.cancellationFeePercent) / 100);
      const refund = round2(paid - retained);

      const updated = await this.saleRepository.finishInstalment(
        id,
        [InstalmentStatus.Active, InstalmentStatus.Paid],
        {
          ...inst,
          status: InstalmentStatus.Cancelled,
          cancelledAt: new Date(),
          cancelledById: userId,
          cancelReason: request.reason,
          refundedAmount: refund,
          refundMethod: request.refundMethod ?? SalePaymentMethod.Cash,
          retainedAmount: retained,
        },
        SaleStatus.Voided,
      );
      if (!updated) {
        return CommonResponses.ConflictResponse<Sale>(
          'This plan can no longer be cancelled',
        );
      }

      for (const item of parent.items) {
        await this.shopInventoryRepository.incrementQuantity(
          parent.shopId,
          item.inventoryId,
          item.quantity,
          item.inventoryInfoSnapshot,
        );
      }
      await this.saleRepository.voidInstalmentPayments(id);

      const shop = await this.shopRepository.getById(parent.shopId);
      if (retained > 0 && shop) {
        const cashier = await this.userRepository.getById(userId);
        const role = cashier?.roleId
          ? await this.roleRepository.getById(cashier.roleId)
          : null;
        const seq = await this.counterRepository.next(`sale:${shop.id}`);
        await this.saleRepository.create({
          shopId: shop.id,
          shopInfoSnapshot: toShopInfo(shop),
          cashierId: userId,
          cashierInfoSnapshot: cashier ? toUserInfo(cashier, role?.name) : null,
          receiptNo: buildReceiptNo(shop, seq),
          items: [],
          serviceItems: [],
          subtotal: retained,
          discount: 0,
          total: retained,
          paymentMethod: SalePaymentMethod.Cash,
          isSplitSale: false,
          status: SaleStatus.Completed,
          customerId: parent.customerId,
          customerInfoSnapshot: parent.customerInfoSnapshot,
          note: `${CANCELLATION_FEE_NOTE_PREFIX} ${parent.receiptNo}`,
          kind: SaleKind.InstalmentPayment,
          parentSaleId: id,
        });
      }
      if (refund > 0) {
        await this.ledgerEntryService.debit(
          parent.shopId,
          refund,
          LedgerSource.InstalmentRefund,
          {
            referenceId: id,
            description: `Refund for cancelled plan ${parent.receiptNo}`,
            recordedById: userId,
          },
        );
      }
      return CommonResponses.OkResponse<Sale>(updated);
    } catch (error) {
      this.logger.error('an error occurred while cancelling an instalment sale', { id, request }, error);
      return CommonResponses.InternalServerErrorResponse<Sale>(
        'An error occurred while cancelling the plan',
      );
    }
  }
}
