import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/dtos/common/api.response.dto';
import { PagedResults } from 'src/dtos/common/paged.results.dto';
import { VendorFilter } from 'src/dtos/vendor/vendor.filter.dto';
import { VendorLedgerEntryFilter } from 'src/dtos/vendor/vendor-ledger-entry.filter.dto';
import { VendorPaymentRequest } from 'src/dtos/vendor/vendor.payment.request.dto';
import { VendorRequest } from 'src/dtos/vendor/vendor.request.dto';
import { VendorResponse } from 'src/dtos/vendor/vendor.response.dto';
import { LedgerSource, VendorLedgerEntryType, VendorStatus } from 'src/enums';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { ShopInfo } from 'src/models/shop/shop-info.model';
import { LedgerEntryService } from 'src/services/ledger-entry.service';
import { ShopRepository } from 'src/repositories/shop.repository';
import { VendorLedgerEntryRepository } from 'src/repositories/vendor-ledger-entry.repository';
import { VendorRepository } from 'src/repositories/vendor.repository';
import { Vendor } from 'src/schemas/vendor.schema';
import { VendorLedgerEntry } from 'src/schemas/vendor-ledger-entry.schema';
import { toPaginationInfo, toShopInfo } from 'src/utils';

@Injectable()
export class VendorService {
  private readonly logger = new Logger(VendorService.name);
  constructor(
    private readonly vendorRepository: VendorRepository,
    private readonly vendorLedgerEntryRepository: VendorLedgerEntryRepository,
    private readonly shopRepository: ShopRepository,
    private readonly ledgerEntryService: LedgerEntryService,
  ) {}

  //get by id
  async getById(id: string): Promise<ApiResponseDto<VendorResponse>> {
    try {
      const vendor = await this.vendorRepository.getById(id);
      if (!vendor) {
        return CommonResponses.NotFoundResponse<VendorResponse>(
          'Vendor not found',
        );
      }
      return CommonResponses.OkResponse<VendorResponse>(
        await this.toVendorResponse(vendor),
      );
    } catch (error) {
      this.logger.error(
        'an error occurred while getting vendor by id',
        id,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<VendorResponse>(
        'An error occurred while getting vendor by id',
      );
    }
  }

  //list, optionally scoped by status, with search over name/contact
  async list(
    filter: VendorFilter,
  ): Promise<ApiResponseDto<PagedResults<VendorResponse>>> {
    try {
      const { page, pageSize } = toPaginationInfo(filter);
      const { results, totalCount } = await this.vendorRepository.list(filter);
      const vendors = await Promise.all(
        results.map((v) => this.toVendorResponse(v)),
      );
      return CommonResponses.OkResponse<PagedResults<VendorResponse>>({
        results: vendors,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error(
        'an error occurred while listing vendors',
        filter,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<
        PagedResults<VendorResponse>
      >('An error occurred while listing vendors');
    }
  }

  //register a vendor
  async create(
    request: VendorRequest,
  ): Promise<ApiResponseDto<VendorResponse>> {
    try {
      const vendor = await this.vendorRepository.create(request);
      return CommonResponses.CreatedResponse<VendorResponse>(
        await this.toVendorResponse(vendor),
      );
    } catch (error) {
      this.logger.error(
        'an error occurred while registering vendor',
        request,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<VendorResponse>(
        'An error occurred while registering vendor',
      );
    }
  }

  //update profile fields
  async update(
    id: string,
    request: VendorRequest,
  ): Promise<ApiResponseDto<VendorResponse>> {
    try {
      const vendor = await this.vendorRepository.update(id, request);
      if (!vendor) {
        return CommonResponses.NotFoundResponse<VendorResponse>(
          'Vendor not found',
        );
      }
      return CommonResponses.OkResponse<VendorResponse>(
        await this.toVendorResponse(vendor),
      );
    } catch (error) {
      this.logger.error(
        'an error occurred while updating vendor',
        { id, request },
        error,
      );
      return CommonResponses.InternalServerErrorResponse<VendorResponse>(
        'An error occurred while updating vendor',
      );
    }
  }

  //this vendor's ledger, newest first
  async getLedger(
    filter: VendorLedgerEntryFilter,
  ): Promise<ApiResponseDto<PagedResults<VendorLedgerEntry>>> {
    try {
      const { page, pageSize } = toPaginationInfo(filter);
      const { results, totalCount } =
        await this.vendorLedgerEntryRepository.list(filter);
      return CommonResponses.OkResponse<PagedResults<VendorLedgerEntry>>({
        results,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error(
        'an error occurred while getting the vendor ledger',
        filter,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<
        PagedResults<VendorLedgerEntry>
      >('An error occurred while getting the vendor ledger');
    }
  }

  //record a repayment: allocates it FIFO against the oldest outstanding
  //charges (so aging reflects what's actually still unpaid), posting one
  //Payment entry per order it settles - each keeps that order's own
  //referenceId, exactly like a Charge does, rather than one lump entry
  //with no order to point back to. Then credits the receiving shop's own
  //cash ledger - the shop only actually gets the cash now, unlike at the
  //original (credit) sale.
  async recordPayment(
    id: string,
    request: VendorPaymentRequest,
    recordedById: string,
  ): Promise<ApiResponseDto<VendorResponse>> {
    try {
      const vendor = await this.vendorRepository.getById(id);
      if (!vendor) {
        return CommonResponses.NotFoundResponse<VendorResponse>(
          'Vendor not found',
        );
      }
      const shop = await this.shopRepository.getById(request.shopId);
      if (!shop) {
        return CommonResponses.NotFoundResponse<VendorResponse>(
          'Shop not found',
        );
      }

      const date = request.date ? new Date(request.date) : new Date();
      let balance = await this.vendorLedgerEntryRepository.getBalance(id);

      const postPayment = (
        amount: number,
        referenceId: string | null,
        description?: string,
      ) => {
        balance += amount;
        return this.vendorLedgerEntryRepository.create({
          vendorId: id,
          date,
          type: VendorLedgerEntryType.Payment,
          amount,
          balanceAfter: balance,
          referenceId: referenceId ?? undefined,
          shopId: request.shopId,
          shopInfoSnapshot: toShopInfo(shop),
          paymentMethod: request.method,
          reference: request.reference,
          description: description ?? request.note,
          recordedById,
        });
      };

      let remaining = request.amount;
      const outstanding =
        await this.vendorLedgerEntryRepository.getOutstandingCharges(id);
      for (const charge of outstanding) {
        if (remaining <= 0) break;
        const allocated = Math.min(remaining, charge.outstandingAmount);
        await this.vendorLedgerEntryRepository.reduceOutstanding(
          charge.id,
          allocated,
        );
        await postPayment(allocated, charge.referenceId);
        remaining -= allocated;
      }

      // Exceeds every outstanding order - held as unallocated credit on the
      // account rather than tied to a specific one.
      if (remaining > 0) {
        await postPayment(
          remaining,
          null,
          request.note ?? 'Advance payment, not yet applied to an order',
        );
      }

      await this.ledgerEntryService.credit(
        request.shopId,
        request.amount,
        LedgerSource.VendorPayment,
        {
          description: `Payment from ${vendor.name}`,
          recordedById,
        },
      );

      const updated = await this.vendorRepository.getById(id);
      return CommonResponses.OkResponse<VendorResponse>(
        await this.toVendorResponse(updated),
      );
    } catch (error) {
      this.logger.error(
        'an error occurred while recording a vendor payment',
        { id, request },
        error,
      );
      return CommonResponses.InternalServerErrorResponse<VendorResponse>(
        'An error occurred while recording a vendor payment',
      );
    }
  }

  /**
   * Internal API for SaleService: whether a vendor can be sold to on
   * credit right now - lean, not HTTP-response-shaped, the same convention
   * as LedgerEntryService.credit/debit. `status` (OnHold) is a manual
   * freeze; everything else is each vendor's own configurable credit
   * policy - all of it optional, and every rule the vendor has turned on
   * must pass. There's still no single platform-wide credit limit - a
   * reliable vendor and a new, unproven one can be governed differently.
   */
  async assertCanSellOnCredit(
    vendorId: string,
  ): Promise<
    { status: 'ok'; vendor: Vendor } | { status: 'error'; message: string }
  > {
    const vendor = await this.vendorRepository.getById(vendorId);
    if (!vendor) return { status: 'error', message: 'Vendor not found' };
    if (vendor.status === VendorStatus.OnHold) {
      return {
        status: 'error',
        message: `${vendor.name}'s credit account is on hold`,
      };
    }

    const needsOutstanding =
      vendor.blockCreditIfAnyOutstanding ||
      vendor.blockCreditIfOverdue ||
      vendor.maxOutstandingCreditBalance != null ||
      vendor.maxOpenCreditSales != null;
    if (!needsOutstanding) return { status: 'ok', vendor };

    const outstanding =
      await this.vendorLedgerEntryRepository.getOutstandingCharges(vendorId);

    if (vendor.blockCreditIfAnyOutstanding && outstanding.length > 0) {
      return {
        status: 'error',
        message: `${vendor.name} already has a pending credit balance`,
      };
    }

    if (vendor.blockCreditIfOverdue) {
      const graceDays = vendor.creditOverdueGraceDays ?? 0;
      const isOverdue = outstanding.some(
        (charge) =>
          charge.dueDate &&
          new Date(charge.dueDate).getTime() + graceDays * 86_400_000 <
            Date.now(),
      );
      if (isOverdue) {
        return {
          status: 'error',
          message: `${vendor.name} has an overdue balance and can't be sold to on credit right now`,
        };
      }
    }

    if (
      vendor.maxOpenCreditSales != null &&
      outstanding.length >= vendor.maxOpenCreditSales
    ) {
      return {
        status: 'error',
        message: `${vendor.name} already has ${outstanding.length} open credit sale(s) - the limit is ${vendor.maxOpenCreditSales}`,
      };
    }

    if (vendor.maxOutstandingCreditBalance != null) {
      const totalOutstanding = outstanding.reduce(
        (sum, c) => sum + c.outstandingAmount,
        0,
      );
      if (totalOutstanding >= vendor.maxOutstandingCreditBalance) {
        return {
          status: 'error',
          message: `${vendor.name}'s outstanding balance is at its credit limit`,
        };
      }
    }

    return { status: 'ok', vendor };
  }

  /**
   * Internal API for SaleService: posts a credit sale as a charge against
   * the vendor's account, due `vendor.termsDays` from today unless
   * `dueDateOverride` is given (e.g. a negotiated exception for this sale).
   * Assumes the caller already checked assertCanSellOnCredit.
   */
  async postCharge(
    vendor: Vendor,
    shopId: string,
    shopInfoSnapshot: ShopInfo,
    amount: number,
    saleId: string,
    note?: string,
    dueDateOverride?: Date,
  ): Promise<VendorLedgerEntry> {
    const balance = await this.vendorLedgerEntryRepository.getBalance(
      vendor.id,
    );
    let dueDate = dueDateOverride;
    if (!dueDate) {
      dueDate = new Date();
      dueDate.setUTCDate(dueDate.getUTCDate() + vendor.termsDays);
    }

    return await this.vendorLedgerEntryRepository.create({
      vendorId: vendor.id,
      type: VendorLedgerEntryType.Charge,
      amount,
      balanceAfter: balance - amount,
      dueDate,
      outstandingAmount: amount,
      referenceId: saleId,
      shopId,
      shopInfoSnapshot,
      description: note,
    });
  }

  private async toVendorResponse(vendor: Vendor): Promise<VendorResponse> {
    const [rawBalance, aging] = await Promise.all([
      this.vendorLedgerEntryRepository.getBalance(vendor.id),
      this.vendorLedgerEntryRepository.getAging(vendor.id, new Date()),
    ]);
    // The ledger's own running balance is negative once the vendor owes
    // money and positive once they've overpaid (see VendorLedgerEntry); the
    // API splits that single signed number into two plain non-negative
    // figures, since every summary view (and the existing client) already
    // reads `balance` as "how much they owe", not a signed statement value.
    const balance = Math.max(0, -rawBalance);
    const overpayment = Math.max(0, rawBalance);
    const overdue = aging.days1to30 + aging.days31to60 + aging.daysOver60;
    return { ...vendor, balance, overdue, overpayment, aging };
  }
}
