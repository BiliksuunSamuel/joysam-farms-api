import { Injectable, Logger } from '@nestjs/common';
import configuration from 'src/configuration';
import { ApiResponseDto } from 'src/dtos/common/api.response.dto';
import { PagedResults } from 'src/dtos/common/paged.results.dto';
import { PaymentTransactionFilter } from 'src/dtos/payment-transaction/payment-transaction.filter.dto';
import { PaymentTransactionTrend } from 'src/dtos/payment-transaction/payment-transaction.trend.dto';
import { PaymentTransactionTrendFilter } from 'src/dtos/payment-transaction/payment-transaction.trend.filter.dto';
import { PaystackVerifyResponseData } from 'src/dtos/paystack/paystack.transaction.verification.response';
import {
  LedgerSource,
  PaymentTransactionStatus,
  PaymentTransactionTrendGroupBy,
  SaleStatus,
} from 'src/enums';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { PaymentAuthorization } from 'src/models/payment/payment-authorization.model';
import { PaymentTransactionRepository } from 'src/repositories/payment-transaction.repository';
import { SaleRepository } from 'src/repositories/sale.repository';
import { ShopInventoryRepository } from 'src/repositories/shop-inventory.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { PaymentTransaction } from 'src/schemas/payment-transaction.schema';
import { Sale } from 'src/schemas/sale.schema';
import { LedgerEntryService } from 'src/services/ledger-entry.service';
import {
  PaystackReferenceNotFoundError,
  PaystackService,
} from 'src/services/paystack.service';
import {
  generateId,
  resolveRequesterShopId,
  toPaginationInfo,
} from 'src/utils';

//maps Paystack's snake_case authorization shape onto our own schema -
//present for both channels, with irrelevant fields left null (e.g. bin for
//mobile_money, mobileMoneyNumber for card).
function toPaymentAuthorization(
  data: PaystackVerifyResponseData['authorization'],
): PaymentAuthorization | null {
  if (!data) return null;
  return {
    authorizationCode: data.authorization_code,
    channel: data.channel,
    bin: data.bin,
    last4: data.last4,
    expMonth: data.exp_month,
    expYear: data.exp_year,
    cardType: data.card_type,
    brand: data.brand,
    reusable: data.reusable,
    bank: data.bank,
    mobileMoneyNumber: data.mobile_money_number,
    accountName: data.account_name,
    countryCode: data.country_code,
  };
}

@Injectable()
export class PaymentTransactionService {
  private readonly logger = new Logger(PaymentTransactionService.name);
  constructor(
    private readonly paymentTransactionRepository: PaymentTransactionRepository,
    private readonly saleRepository: SaleRepository,
    private readonly shopInventoryRepository: ShopInventoryRepository,
    private readonly ledgerEntryService: LedgerEntryService,
    private readonly paystackService: PaystackService,
    private readonly userRepository: UserRepository,
  ) {}

  //list, optionally scoped by shop/status/channel - a shop-tied requester
  //is always forced to their own shop, same as SaleService.list.
  async list(
    filter: PaymentTransactionFilter,
    requesterId: string,
  ): Promise<ApiResponseDto<PagedResults<PaymentTransaction>>> {
    try {
      const { page, pageSize } = toPaginationInfo(filter);
      const shopId = await resolveRequesterShopId(
        requesterId,
        this.userRepository,
      );
      const scoped = shopId ? { ...filter, shopId } : filter;
      const { results, totalCount } =
        await this.paymentTransactionRepository.list(scoped);
      return CommonResponses.OkResponse<PagedResults<PaymentTransaction>>({
        results,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error(
        'an error occurred while listing payment transactions',
        filter,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<
        PagedResults<PaymentTransaction>
      >('An error occurred while listing payment transactions');
    }
  }

  //volume + success-count trend, bucketed over time - mirrors
  //SaleService.getSalesTrend()'s time-based branch (gap-filling every
  //bucket so the chart never has holes), scoped down to just the time
  //groupings this domain needs.
  async getTrend(
    filter: PaymentTransactionTrendFilter,
    requesterId: string,
  ): Promise<ApiResponseDto<PaymentTransactionTrend[]>> {
    try {
      const groupBy = filter?.groupBy ?? PaymentTransactionTrendGroupBy.Day;
      const { start, end } = this.resolveTrendRange(filter, groupBy);
      const shopId = await resolveRequesterShopId(
        requesterId,
        this.userRepository,
      );

      const rows = await this.paymentTransactionRepository.getTrend({
        ...filter,
        ...(shopId ? { shopId } : {}),
        groupBy,
        startDate: start,
        endDate: end,
      });

      const byKey = new Map(rows.map((row) => [row.key, row]));
      const trend: PaymentTransactionTrend[] = [];
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

      return CommonResponses.OkResponse<PaymentTransactionTrend[]>(trend);
    } catch (error) {
      this.logger.error(
        'an error occurred while getting payment transaction trend',
        filter,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<
        PaymentTransactionTrend[]
      >('An error occurred while getting payment transaction trend');
    }
  }

  private resolveTrendRange(
    filter: PaymentTransactionTrendFilter,
    groupBy: PaymentTransactionTrendGroupBy,
  ): { start: Date; end: Date } {
    const end = filter?.endDate ? new Date(filter.endDate) : new Date();
    if (filter?.startDate) {
      return { start: new Date(filter.startDate), end };
    }

    const start = new Date(end);
    switch (groupBy) {
      case PaymentTransactionTrendGroupBy.Hour:
        start.setUTCHours(start.getUTCHours() - 23, 0, 0, 0); // last 24 hours
        break;
      case PaymentTransactionTrendGroupBy.Week:
        start.setUTCDate(start.getUTCDate() - 56); // last 8 weeks
        break;
      case PaymentTransactionTrendGroupBy.Month:
        start.setUTCMonth(start.getUTCMonth() - 11); // last 12 months
        break;
      case PaymentTransactionTrendGroupBy.Year:
        start.setUTCFullYear(start.getUTCFullYear() - 4); // last 5 years
        break;
      case PaymentTransactionTrendGroupBy.Day:
      default:
        start.setUTCDate(start.getUTCDate() - 6); // last 7 days
        break;
    }
    return { start, end };
  }

  private startOfTrendBucket(
    date: Date,
    groupBy: PaymentTransactionTrendGroupBy,
  ): Date {
    const d = new Date(date);
    switch (groupBy) {
      case PaymentTransactionTrendGroupBy.Hour:
        d.setUTCMinutes(0, 0, 0);
        return d;
      case PaymentTransactionTrendGroupBy.Week: {
        const dayNum = (d.getUTCDay() + 6) % 7; // Monday = 0
        d.setUTCDate(d.getUTCDate() - dayNum);
        d.setUTCHours(0, 0, 0, 0);
        return d;
      }
      case PaymentTransactionTrendGroupBy.Month:
        d.setUTCDate(1);
        d.setUTCHours(0, 0, 0, 0);
        return d;
      case PaymentTransactionTrendGroupBy.Year:
        d.setUTCMonth(0, 1);
        d.setUTCHours(0, 0, 0, 0);
        return d;
      case PaymentTransactionTrendGroupBy.Day:
      default:
        d.setUTCHours(0, 0, 0, 0);
        return d;
    }
  }

  private advanceTrendBucket(
    date: Date,
    groupBy: PaymentTransactionTrendGroupBy,
  ): Date {
    const d = new Date(date);
    switch (groupBy) {
      case PaymentTransactionTrendGroupBy.Hour:
        d.setUTCHours(d.getUTCHours() + 1);
        return d;
      case PaymentTransactionTrendGroupBy.Week:
        d.setUTCDate(d.getUTCDate() + 7);
        return d;
      case PaymentTransactionTrendGroupBy.Month:
        d.setUTCMonth(d.getUTCMonth() + 1);
        return d;
      case PaymentTransactionTrendGroupBy.Year:
        d.setUTCFullYear(d.getUTCFullYear() + 1);
        return d;
      case PaymentTransactionTrendGroupBy.Day:
      default:
        d.setUTCDate(d.getUTCDate() + 1);
        return d;
    }
  }

  //must match the $dateToString format used for the same groupBy in
  //PaymentTransactionRepository.getTrend exactly, since this is how
  //gap-filled buckets are matched up against real aggregation results
  private trendBucketKey(
    date: Date,
    groupBy: PaymentTransactionTrendGroupBy,
  ): string {
    switch (groupBy) {
      case PaymentTransactionTrendGroupBy.Hour:
        return `${date.toISOString().slice(0, 13)}:00`;
      case PaymentTransactionTrendGroupBy.Week:
        return this.isoWeekKey(date);
      case PaymentTransactionTrendGroupBy.Month:
        return date.toISOString().slice(0, 7);
      case PaymentTransactionTrendGroupBy.Year:
        return String(date.getUTCFullYear());
      case PaymentTransactionTrendGroupBy.Day:
      default:
        return date.toISOString().slice(0, 10);
    }
  }

  //ISO 8601 week-numbering year + week, e.g. "2026-W38" - matches Mongo's
  //%G-%V format exactly, including the year-boundary edge case where the
  //first/last days of a calendar year belong to a week in the adjacent
  //ISO year. (Identical to SaleService's own isoWeekKey - kept as a small,
  //self-contained duplicate here rather than a shared util, to avoid
  //touching the already-shipped Sales trend code for this feature.)
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

  //starts a Paystack transaction for a just-created Pending sale (stock is
  //already deducted by the time this runs - see SaleService.create). If
  //Paystack can't be reached or rejects the request, the reservation is
  //released immediately (void + restore stock) rather than leaving a
  //Pending sale with no way to ever be paid.
  //
  //amountGhs is the gateway-settled amount - the whole sale.total for a
  //pure Digital sale, or just the momo leg's amount for a Split sale (whose
  //cash leg was already collected at the till, outside Paystack entirely).
  async initiateForSale(
    sale: Sale,
    email: string,
    amountGhs: number,
  ): Promise<{ authorizationUrl: string } | null> {
    const reference = `PSK-${generateId()}`;
    // Lands back on checkout itself - it polls this reference and opens the
    // same receipt dialog a synchronous sale gets, rather than a separate
    // confirmation page.
    const callbackUrl = `${configuration().application.clientBaseUrl}/dashboard/checkout?reference=${reference}`;

    const res = await this.paystackService.initiateTransaction({
      reference,
      amountGhs,
      email,
      callbackUrl,
    });

    if (!res?.data?.authorization_url) {
      this.logger.error(
        'could not initiate paystack transaction for sale',
        sale.id,
      );
      await this.voidPendingSale(sale);
      return null;
    }

    await this.paymentTransactionRepository.create({
      saleId: sale.id,
      reference,
      shopId: sale.shopId,
      amount: amountGhs,
      email,
      authorizationUrl: res.data.authorization_url,
    });

    return { authorizationUrl: res.data.authorization_url };
  }

  //the authorizationUrl for a just-created Digital sale, for the frontend
  //to redirect to right after charging.
  async getBySaleId(
    saleId: string,
  ): Promise<ApiResponseDto<PaymentTransaction>> {
    const txn = await this.paymentTransactionRepository.getBySaleId(saleId);
    if (!txn) {
      return CommonResponses.NotFoundResponse<PaymentTransaction>(
        'Payment transaction not found',
      );
    }
    return CommonResponses.OkResponse<PaymentTransaction>(txn);
  }

  //the single shared, idempotent core - called by the webhook, the
  //cashier-facing poll endpoint, and the abandonment sweep. Whichever of
  //them reaches Sale's atomic compare-and-swap first is the only one that
  //posts the ledger credit or restores stock; the rest are safe no-ops.
  async confirmDigitalPayment(
    reference: string,
  ): Promise<ApiResponseDto<Sale>> {
    try {
      const txn =
        await this.paymentTransactionRepository.getByReference(reference);
      if (!txn) {
        return CommonResponses.NotFoundResponse<Sale>(
          'Payment reference not found',
        );
      }

      const sale = await this.saleRepository.getById(txn.saleId);
      if (!sale) {
        return CommonResponses.NotFoundResponse<Sale>('Sale not found');
      }

      // Fast, safe no-op: once the sale has left Pending there is nothing
      // more to do, regardless of what this transaction's own status says
      // (self-healing if a prior attempt crashed between the two writes).
      if (sale.status !== SaleStatus.Pending) {
        return CommonResponses.OkResponse<Sale>(sale);
      }

      // Never trust a webhook payload alone - always re-verify with
      // Paystack directly. Cheap: only reached while still Pending.
      let verified: PaystackVerifyResponseData | null;
      try {
        verified = await this.paystackService.checkStatus(reference);
      } catch (error) {
        if (error instanceof PaystackReferenceNotFoundError) {
          // This reference was never actually initiated on Paystack's side
          // (e.g. initialize failed after our local records were already
          // written) - it will never resolve, so void now instead of
          // letting the sweep retry it every 5 minutes forever.
          return CommonResponses.OkResponse<Sale>(
            await this.voidPendingSale(
              sale,
              'Transaction reference not found on Paystack - payment was never initiated',
            ),
          );
        }
        throw error;
      }
      if (!verified) {
        return CommonResponses.InternalServerErrorResponse<Sale>(
          'Could not verify this payment with Paystack',
        );
      }

      if (verified.status === 'success') {
        return CommonResponses.OkResponse<Sale>(
          await this.completeSale(sale, txn, verified),
        );
      }

      if (verified.status === 'failed' || verified.status === 'abandoned') {
        return CommonResponses.OkResponse<Sale>(
          await this.voidPendingSale(sale, verified.gateway_response, verified),
        );
      }

      // Still pending on Paystack's side too.
      return CommonResponses.OkResponse<Sale>(sale);
    } catch (error) {
      this.logger.error(
        'an error occurred while confirming a digital payment',
        reference,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<Sale>(
        'An error occurred while confirming this payment',
      );
    }
  }

  private async completeSale(
    sale: Sale,
    txn: PaymentTransaction,
    verified: PaystackVerifyResponseData,
  ): Promise<Sale> {
    const completed = await this.saleRepository.finalize(
      sale.id,
      SaleStatus.Pending,
      SaleStatus.Completed,
    );
    if (completed) {
      // Only the caller that actually won the compare-and-swap gets here -
      // exactly one ledger credit is ever posted for this sale.
      await this.ledgerEntryService.credit(
        completed.shopId,
        completed.total,
        LedgerSource.Sale,
        {
          referenceId: completed.id,
          description: `Sale ${completed.receiptNo}`,
          recordedById: completed.cashierId,
        },
      );
    }
    await this.paymentTransactionRepository.updateStatus(
      txn.reference,
      PaymentTransactionStatus.Success,
      {
        paidAt: verified.paid_at ? new Date(verified.paid_at) : new Date(),
        channel: verified.channel,
        gatewayResponse: verified.gateway_response,
        paystackTransactionId: verified.id,
        currency: verified.currency,
        fees: verified.fees,
        ipAddress: verified.ip_address,
        customerCode: verified.customer?.customer_code,
        authorization: toPaymentAuthorization(verified.authorization),
        attempts: verified.log?.attempts,
      },
    );
    return completed ?? (await this.saleRepository.getById(sale.id));
  }

  private async voidPendingSale(
    sale: Sale,
    failureReason?: string,
    verified?: PaystackVerifyResponseData,
  ): Promise<Sale> {
    const voided = await this.saleRepository.finalize(
      sale.id,
      SaleStatus.Pending,
      SaleStatus.Voided,
    );
    if (voided) {
      // Only the caller that actually won the compare-and-swap restores
      // stock - exactly once.
      for (const item of voided.items) {
        await this.shopInventoryRepository.incrementQuantity(
          voided.shopId,
          item.inventoryId,
          item.quantity,
          item.inventoryInfoSnapshot,
        );
      }
    }
    const txn = await this.paymentTransactionRepository.getBySaleId(sale.id);
    if (txn) {
      await this.paymentTransactionRepository.updateStatus(
        txn.reference,
        failureReason
          ? PaymentTransactionStatus.Failed
          : PaymentTransactionStatus.Abandoned,
        {
          failureReason,
          // Present even on a failed/abandoned attempt - useful context
          // (how many tries, what network/number if any) without needing
          // to ask the cashier what happened.
          paystackTransactionId: verified?.id,
          currency: verified?.currency,
          ipAddress: verified?.ip_address,
          authorization: verified
            ? toPaymentAuthorization(verified.authorization)
            : undefined,
          attempts: verified?.log?.attempts,
        },
      );
    }
    return voided ?? (await this.saleRepository.getById(sale.id));
  }
}
