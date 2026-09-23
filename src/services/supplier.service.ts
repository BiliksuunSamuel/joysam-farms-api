import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/dtos/common/api.response.dto';
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import { DropdownOption } from 'src/dtos/common/dropdown.option.dto';
import { PagedResults } from 'src/dtos/common/paged.results.dto';
import { SupplierDropdownFilter } from 'src/dtos/supplier/supplier.dropdown.filter.dto';
import { SupplierLedgerEntryFilter } from 'src/dtos/supplier/supplier-ledger-entry.filter.dto';
import { SupplierInventoryLedgerEntryFilter } from 'src/dtos/supplier/supplier-inventory-ledger-entry.filter.dto';
import { SupplierPaymentRequest } from 'src/dtos/supplier/supplier.payment.request.dto';
import { SupplierRequest } from 'src/dtos/supplier/supplier.request.dto';
import { SupplierResponse } from 'src/dtos/supplier/supplier.response.dto';
import { LedgerSource, SupplierLedgerEntryType } from 'src/enums';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { InventoryInfo } from 'src/models/inventory/inventory-info.model';
import { LedgerEntryService } from 'src/services/ledger-entry.service';
import { ShopRepository } from 'src/repositories/shop.repository';
import { SupplierLedgerEntryRepository } from 'src/repositories/supplier-ledger-entry.repository';
import { SupplierInventoryLedgerEntryRepository } from 'src/repositories/supplier-inventory-ledger-entry.repository';
import { SupplierRepository } from 'src/repositories/supplier.repository';
import { Supplier } from 'src/schemas/supplier.schema';
import { SupplierLedgerEntry } from 'src/schemas/supplier-ledger-entry.schema';
import { SupplierInventoryLedgerEntry } from 'src/schemas/supplier-inventory-ledger-entry.schema';
import { normalizePhone, toPaginationInfo, toShopInfo } from 'src/utils';

@Injectable()
export class SupplierService {
  private readonly logger = new Logger(SupplierService.name);
  constructor(
    private readonly supplierRepository: SupplierRepository,
    private readonly supplierLedgerEntryRepository: SupplierLedgerEntryRepository,
    private readonly supplierInventoryLedgerEntryRepository: SupplierInventoryLedgerEntryRepository,
    private readonly shopRepository: ShopRepository,
    private readonly ledgerEntryService: LedgerEntryService,
  ) {}

  async getById(id: string): Promise<ApiResponseDto<SupplierResponse>> {
    try {
      const supplier = await this.supplierRepository.getById(id);
      if (!supplier) {
        return CommonResponses.NotFoundResponse<SupplierResponse>(
          'Supplier not found',
        );
      }
      return CommonResponses.OkResponse<SupplierResponse>(
        await this.toSupplierResponse(supplier),
      );
    } catch (error) {
      this.logger.error(
        'an error occurred while getting supplier by id',
        id,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<SupplierResponse>(
        'An error occurred while getting supplier by id',
      );
    }
  }

  async listForDropdown(
    filter: SupplierDropdownFilter,
  ): Promise<ApiResponseDto<DropdownOption[]>> {
    try {
      const results = await this.supplierRepository.listForDropdown(filter);
      return CommonResponses.OkResponse<DropdownOption[]>(results);
    } catch (error) {
      this.logger.error(
        'an error occurred while listing suppliers for dropdown',
        filter,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<DropdownOption[]>(
        'An error occurred while listing suppliers',
      );
    }
  }

  async list(
    filter: BaseFilter,
  ): Promise<ApiResponseDto<PagedResults<SupplierResponse>>> {
    try {
      const { page, pageSize } = toPaginationInfo(filter);
      const { results, totalCount } =
        await this.supplierRepository.list(filter);
      const responses = await Promise.all(
        results.map((s) => this.toSupplierResponse(s)),
      );
      return CommonResponses.OkResponse<PagedResults<SupplierResponse>>({
        results: responses,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error(
        'an error occurred while listing suppliers',
        filter,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<
        PagedResults<SupplierResponse>
      >('An error occurred while listing suppliers');
    }
  }

  async create(
    request: SupplierRequest,
  ): Promise<ApiResponseDto<SupplierResponse>> {
    try {
      const supplier = await this.supplierRepository.create({
        ...request,
        phone: normalizePhone(request.phone),
      });
      return CommonResponses.CreatedResponse<SupplierResponse>(
        await this.toSupplierResponse(supplier),
      );
    } catch (error) {
      this.logger.error(
        'an error occurred while creating supplier',
        request,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<SupplierResponse>(
        'An error occurred while creating supplier',
      );
    }
  }

  async update(
    id: string,
    request: SupplierRequest,
  ): Promise<ApiResponseDto<SupplierResponse>> {
    try {
      const supplier = await this.supplierRepository.update(id, {
        ...request,
        phone: normalizePhone(request.phone),
      });
      if (!supplier) {
        return CommonResponses.NotFoundResponse<SupplierResponse>(
          'Supplier not found',
        );
      }
      return CommonResponses.OkResponse<SupplierResponse>(
        await this.toSupplierResponse(supplier),
      );
    } catch (error) {
      this.logger.error(
        'an error occurred while updating supplier',
        { id, request },
        error,
      );
      return CommonResponses.InternalServerErrorResponse<SupplierResponse>(
        'An error occurred while updating supplier',
      );
    }
  }

  async delete(id: string): Promise<ApiResponseDto<Supplier>> {
    try {
      const existing = await this.supplierRepository.getById(id);
      if (!existing) {
        return CommonResponses.NotFoundResponse<Supplier>('Supplier not found');
      }
      const supplier = await this.supplierRepository.delete(id);
      if (!supplier) {
        return CommonResponses.NotFoundResponse<Supplier>('Supplier not found');
      }
      return CommonResponses.OkResponse<Supplier>(supplier);
    } catch (error) {
      this.logger.error('an error occurred while deleting supplier', id, error);
      return CommonResponses.InternalServerErrorResponse<Supplier>(
        'An error occurred while deleting supplier',
      );
    }
  }

  //the supplier's statement - every ledger entry, newest first
  async getLedger(
    filter: SupplierLedgerEntryFilter,
  ): Promise<ApiResponseDto<PagedResults<SupplierLedgerEntry>>> {
    try {
      const { page, pageSize } = toPaginationInfo(filter);
      const { results, totalCount } =
        await this.supplierLedgerEntryRepository.list(filter);
      return CommonResponses.OkResponse<PagedResults<SupplierLedgerEntry>>({
        results,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error(
        'an error occurred while getting the supplier ledger',
        filter,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<
        PagedResults<SupplierLedgerEntry>
      >('An error occurred while getting the supplier ledger');
    }
  }

  //what a supplier has actually delivered, newest first - the inventory
  //counterpart to getLedger's money view
  async getInventoryLedger(
    filter: SupplierInventoryLedgerEntryFilter,
  ): Promise<ApiResponseDto<PagedResults<SupplierInventoryLedgerEntry>>> {
    try {
      const { page, pageSize } = toPaginationInfo(filter);
      const { results, totalCount } =
        await this.supplierInventoryLedgerEntryRepository.list(filter);
      return CommonResponses.OkResponse<
        PagedResults<SupplierInventoryLedgerEntry>
      >({
        results,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error(
        'an error occurred while getting the supplier inventory ledger',
        filter,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<
        PagedResults<SupplierInventoryLedgerEntry>
      >('An error occurred while getting the supplier inventory ledger');
    }
  }

  //manager records a payment made to the supplier - posts one Payment entry
  //for the full amount (no per-bill FIFO allocation - see
  //SupplierLedgerEntry's own comment) and debits the paying shop's cash
  //wallet, since money is leaving it
  async recordPayment(
    id: string,
    request: SupplierPaymentRequest,
    recordedById: string,
  ): Promise<ApiResponseDto<SupplierResponse>> {
    try {
      const supplier = await this.supplierRepository.getById(id);
      if (!supplier) {
        return CommonResponses.NotFoundResponse<SupplierResponse>(
          'Supplier not found',
        );
      }
      const shop = await this.shopRepository.getById(request.shopId);
      if (!shop) {
        return CommonResponses.NotFoundResponse<SupplierResponse>(
          'Shop not found',
        );
      }

      const date = request.date ? new Date(request.date) : new Date();
      const balance = await this.supplierLedgerEntryRepository.getBalance(id);

      await this.supplierLedgerEntryRepository.create({
        supplierId: id,
        date,
        type: SupplierLedgerEntryType.Payment,
        amount: request.amount,
        balanceAfter: balance - request.amount,
        shopId: request.shopId,
        shopInfoSnapshot: toShopInfo(shop),
        paymentMethod: request.method,
        reference: request.reference,
        description: request.note,
        recordedById,
      });

      await this.ledgerEntryService.debit(
        request.shopId,
        request.amount,
        LedgerSource.SupplierPayment,
        {
          description: `Payment to ${supplier.name}`,
          recordedById,
        },
      );

      const updated = await this.supplierRepository.getById(id);
      return CommonResponses.OkResponse<SupplierResponse>(
        await this.toSupplierResponse(updated),
      );
    } catch (error) {
      this.logger.error(
        'an error occurred while recording a supplier payment',
        { id, request },
        error,
      );
      return CommonResponses.InternalServerErrorResponse<SupplierResponse>(
        'An error occurred while recording a supplier payment',
      );
    }
  }

  // Internal API for SupplyRequestService: post a Bill entry for goods
  // received - called once per approved supply request, for the total cost
  // (item costPrice x quantity, summed across every line) rather than one
  // entry per line. Lean, not HTTP-response-shaped, the same convention as
  // CustomerService.findOrCreateForSale.
  async postBill(
    supplierId: string,
    amount: number,
    referenceId: string,
  ): Promise<void> {
    if (amount <= 0) return;
    const balance =
      await this.supplierLedgerEntryRepository.getBalance(supplierId);
    await this.supplierLedgerEntryRepository.create({
      supplierId,
      type: SupplierLedgerEntryType.Bill,
      amount,
      balanceAfter: balance + amount,
      referenceId,
      description: 'Goods received into the warehouse',
    });
  }

  // Internal API for SupplyRequestService (once per approved line item) and
  // InventoryService (once, for a new item's initial quantity) - post one
  // inventory-ledger entry for stock that actually arrived, alongside a
  // postBill call for what it cost.
  async postInventoryDelivery(
    supplierId: string,
    inventoryId: string,
    inventoryInfoSnapshot: InventoryInfo,
    quantity: number,
    expiryDate: Date,
    referenceId: string,
  ): Promise<void> {
    await this.supplierInventoryLedgerEntryRepository.create({
      supplierId,
      inventoryId,
      inventoryInfoSnapshot,
      quantity,
      expiryDate,
      referenceId,
    });
  }

  private async toSupplierResponse(
    supplier: Supplier,
  ): Promise<SupplierResponse> {
    const rawBalance = await this.supplierLedgerEntryRepository.getBalance(
      supplier.id,
    );
    // The ledger's own running balance is positive once we owe the
    // supplier money and negative once we've overpaid (see
    // SupplierLedgerEntry); the API splits that single signed number into
    // two plain non-negative figures, matching VendorResponse's own
    // balance/overpayment split.
    const balance = Math.max(0, rawBalance);
    const overpayment = Math.max(0, -rawBalance);
    return { ...supplier, balance, overpayment };
  }
}
