import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/dtos/common/api.response.dto';
import { PagedResults } from 'src/dtos/common/paged.results.dto';
import { SupplyRequestFilter } from 'src/dtos/supply-request/supply-request.filter.dto';
import { SupplyRequestRequest } from 'src/dtos/supply-request/supply-request.request.dto';
import { SupplyRequestReview } from 'src/dtos/supply-request/supply-request.review.dto';
import { SupplyRequestStatus } from 'src/enums';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { SupplyRequestItem } from 'src/models/supply-request/supply-request-item.model';
import { InventoryRepository } from 'src/repositories/inventory.repository';
import { SupplierRepository } from 'src/repositories/supplier.repository';
import { SupplyRequestRepository } from 'src/repositories/supply-request.repository';
import { SupplyRequest } from 'src/schemas/supply-request.schema';
import { SupplierService } from 'src/services/supplier.service';
import { toInventoryInfo, toPaginationInfo, toSupplierInfo } from 'src/utils';

@Injectable()
export class SupplyRequestService {
  private readonly logger = new Logger(SupplyRequestService.name);
  constructor(
    private readonly supplyRequestRepository: SupplyRequestRepository,
    private readonly supplierRepository: SupplierRepository,
    private readonly inventoryRepository: InventoryRepository,
    private readonly supplierService: SupplierService,
  ) {}

  //get by id
  async getById(id: string): Promise<ApiResponseDto<SupplyRequest>> {
    try {
      const supplyRequest = await this.supplyRequestRepository.getById(id);
      if (!supplyRequest) {
        return CommonResponses.NotFoundResponse<SupplyRequest>(
          'Supply request not found',
        );
      }
      return CommonResponses.OkResponse<SupplyRequest>(supplyRequest);
    } catch (error) {
      this.logger.error(
        'an error occurred while getting supply request by id',
        id,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<SupplyRequest>(
        'An error occurred while getting supply request by id',
      );
    }
  }

  //list, optionally scoped by supplier, item or status
  async list(
    filter: SupplyRequestFilter,
  ): Promise<ApiResponseDto<PagedResults<SupplyRequest>>> {
    try {
      const { page, pageSize } = toPaginationInfo(filter);
      const { results, totalCount } =
        await this.supplyRequestRepository.list(filter);
      return CommonResponses.OkResponse<PagedResults<SupplyRequest>>({
        results,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error(
        'an error occurred while listing supply requests',
        filter,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<
        PagedResults<SupplyRequest>
      >('An error occurred while listing supply requests');
    }
  }

  //raise an order for more stock from a supplier
  async create(
    request: SupplyRequestRequest,
    requestedById: string,
  ): Promise<ApiResponseDto<SupplyRequest>> {
    try {
      const supplier = await this.supplierRepository.getById(
        request.supplierId,
      );
      if (!supplier) {
        return CommonResponses.NotFoundResponse<SupplyRequest>(
          'Supplier not found',
        );
      }

      const ids = request.items.map((i) => i.inventoryId);
      if (new Set(ids).size !== ids.length) {
        return CommonResponses.BadRequestResponse<SupplyRequest>(
          undefined,
          'The same item appears more than once in this request',
        );
      }

      const items: SupplyRequestItem[] = [];
      for (const line of request.items) {
        const inventory = await this.inventoryRepository.getById(
          line.inventoryId,
        );
        if (!inventory) {
          return CommonResponses.NotFoundResponse<SupplyRequest>(
            'One of the requested items no longer exists',
          );
        }
        items.push({
          inventoryId: inventory.id,
          inventoryInfoSnapshot: toInventoryInfo(inventory),
          quantity: line.quantity,
          expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
        });
      }

      const supplyRequest = await this.supplyRequestRepository.create({
        supplierId: request.supplierId,
        supplierInfoSnapshot: toSupplierInfo(supplier),
        items,
        notes: request.notes,
        requestedById,
      });
      return CommonResponses.CreatedResponse<SupplyRequest>(supplyRequest);
    } catch (error) {
      this.logger.error(
        'an error occurred while creating supply request',
        request,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<SupplyRequest>(
        'An error occurred while creating supply request',
      );
    }
  }

  //approve a request: the delivery has arrived, so every line's warehouse
  //quantity increases immediately by its full requested amount
  async approve(
    id: string,
    reviewedById: string,
    review: SupplyRequestReview,
  ): Promise<ApiResponseDto<SupplyRequest>> {
    try {
      const supplyRequest = await this.supplyRequestRepository.getById(id);
      if (!supplyRequest) {
        return CommonResponses.NotFoundResponse<SupplyRequest>(
          'Supply request not found',
        );
      }
      if (supplyRequest.status !== SupplyRequestStatus.Pending) {
        return CommonResponses.BadRequestResponse<SupplyRequest>(
          undefined,
          'Only a pending supply request can be approved',
        );
      }

      // Also accumulates the total cost of this delivery (item costPrice x
      // quantity, summed across every line) while we're already fetching
      // each Inventory doc for the existence check - this becomes the
      // single Bill posted to the supplier's wallet below.
      let totalCost = 0;
      for (const item of supplyRequest.items) {
        const inventory = await this.inventoryRepository.getById(
          item.inventoryId,
        );
        if (!inventory) {
          return CommonResponses.BadRequestResponse<SupplyRequest>(
            undefined,
            `${item.inventoryInfoSnapshot?.name ?? item.inventoryId} no longer exists in the warehouse catalog`,
          );
        }
        totalCost += (inventory.costPrice ?? 0) * item.quantity;
      }

      for (const item of supplyRequest.items) {
        await this.inventoryRepository.receiveStock(
          item.inventoryId,
          item.quantity,
          item.expiryDate,
        );
        await this.supplierService.postInventoryDelivery(
          supplyRequest.supplierId,
          item.inventoryId,
          item.inventoryInfoSnapshot,
          item.quantity,
          item.expiryDate,
          id,
        );
      }

      await this.supplierService.postBill(
        supplyRequest.supplierId,
        totalCost,
        id,
      );

      const approved = await this.supplyRequestRepository.approve(
        id,
        reviewedById,
        review?.notes,
      );
      return CommonResponses.OkResponse<SupplyRequest>(approved);
    } catch (error) {
      this.logger.error(
        'an error occurred while approving supply request',
        { id, reviewedById },
        error,
      );
      return CommonResponses.InternalServerErrorResponse<SupplyRequest>(
        'An error occurred while approving supply request',
      );
    }
  }

  //reject a request
  async reject(
    id: string,
    reviewedById: string,
    review: SupplyRequestReview,
  ): Promise<ApiResponseDto<SupplyRequest>> {
    try {
      const supplyRequest = await this.supplyRequestRepository.getById(id);
      if (!supplyRequest) {
        return CommonResponses.NotFoundResponse<SupplyRequest>(
          'Supply request not found',
        );
      }
      if (supplyRequest.status !== SupplyRequestStatus.Pending) {
        return CommonResponses.BadRequestResponse<SupplyRequest>(
          undefined,
          'Only a pending supply request can be rejected',
        );
      }

      const rejected = await this.supplyRequestRepository.reject(
        id,
        reviewedById,
        review?.notes,
      );
      return CommonResponses.OkResponse<SupplyRequest>(rejected);
    } catch (error) {
      this.logger.error(
        'an error occurred while rejecting supply request',
        { id, reviewedById },
        error,
      );
      return CommonResponses.InternalServerErrorResponse<SupplyRequest>(
        'An error occurred while rejecting supply request',
      );
    }
  }
}
