import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/dtos/common/api.response.dto';
import { PagedResults } from 'src/dtos/common/paged.results.dto';
import { StockRequestFilter } from 'src/dtos/stock-request/stock-request.filter.dto';
import { StockRequestReview } from 'src/dtos/stock-request/stock-request.review.dto';
import { StockRequestRequest } from 'src/dtos/stock-request/stock-request.request.dto';
import { StockRequestTrend } from 'src/dtos/stock-request/stock-request.trend.dto';
import { StockRequestTrendFilter } from 'src/dtos/stock-request/stock-request.trend.filter.dto';
import { StockRequestStatus, StockRequestTrendGroupBy } from 'src/enums';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { StockRequestItem } from 'src/models/stock-request/stock-request-item.model';
import { InventoryRepository } from 'src/repositories/inventory.repository';
import { ShopRepository } from 'src/repositories/shop.repository';
import { StockRequestRepository } from 'src/repositories/stock-request.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { StockRequest } from 'src/schemas/stock-request.schema';
import { TransferService } from 'src/services/transfer.service';
import {
  advanceDayWeekMonthBucket,
  dayWeekMonthBucketKey,
  resolveDayWeekMonthRange,
  resolveRequesterShopId,
  startOfDayWeekMonthBucket,
  toInventoryInfo,
  toPaginationInfo,
  toShopInfo,
} from 'src/utils';

@Injectable()
export class StockRequestService {
  private readonly logger = new Logger(StockRequestService.name);
  constructor(
    private readonly stockRequestRepository: StockRequestRepository,
    private readonly shopRepository: ShopRepository,
    private readonly inventoryRepository: InventoryRepository,
    private readonly transferService: TransferService,
    private readonly userRepository: UserRepository,
  ) {}

  //get by id
  async getById(id: string, requesterId: string): Promise<ApiResponseDto<StockRequest>> {
    try {
      const stockRequest = await this.stockRequestRepository.getById(id);
      if (!stockRequest) {
        return CommonResponses.NotFoundResponse<StockRequest>(
          'Stock request not found',
        );
      }
      const shopId = await resolveRequesterShopId(requesterId, this.userRepository);
      if (shopId && stockRequest.shopId !== shopId) {
        return CommonResponses.NotFoundResponse<StockRequest>(
          'Stock request not found',
        );
      }
      return CommonResponses.OkResponse<StockRequest>(stockRequest);
    } catch (error) {
      this.logger.error(
        'an error occurred while getting stock request by id',
        id,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<StockRequest>(
        'An error occurred while getting stock request by id',
      );
    }
  }

  // Request activity trend for a shop: value1 is requests raised, value2 is
  // how many of those were approved, per bucket - every bucket in range
  // appears even with no activity, so a chart has no gaps.
  async getTrend(
    filter: StockRequestTrendFilter,
    requesterId: string,
  ): Promise<ApiResponseDto<StockRequestTrend[]>> {
    try {
      const groupBy = filter?.groupBy ?? StockRequestTrendGroupBy.Day;
      const { start, end } = resolveDayWeekMonthRange(filter?.startDate, filter?.endDate, groupBy);
      const shopId = await resolveRequesterShopId(requesterId, this.userRepository);

      const rows = await this.stockRequestRepository.getTrend({
        ...filter,
        ...(shopId ? { shopId } : {}),
        groupBy,
        startDate: start,
        endDate: end,
      });

      const byKey = new Map(rows.map((row) => [row.key, row]));
      const trend: StockRequestTrend[] = [];
      const lastKey = dayWeekMonthBucketKey(end, groupBy);
      let cursor = startOfDayWeekMonthBucket(start, groupBy);
      for (let i = 0; i < 5000; i++) {
        const key = dayWeekMonthBucketKey(cursor, groupBy);
        const row = byKey.get(key);
        trend.push({ label: key, value1: row?.value1 ?? 0, value2: row?.value2 ?? 0 });
        if (key === lastKey) break;
        cursor = advanceDayWeekMonthBucket(cursor, groupBy);
      }

      return CommonResponses.OkResponse<StockRequestTrend[]>(trend);
    } catch (error) {
      this.logger.error('an error occurred while getting the stock request trend', filter, error);
      return CommonResponses.InternalServerErrorResponse<StockRequestTrend[]>(
        'An error occurred while getting the stock request trend',
      );
    }
  }

  //list, optionally scoped by shop, item or status - a shop-tied requester
  //is always forced to their own shop
  async list(
    filter: StockRequestFilter,
    requesterId: string,
  ): Promise<ApiResponseDto<PagedResults<StockRequest>>> {
    try {
      const { page, pageSize } = toPaginationInfo(filter);
      const shopId = await resolveRequesterShopId(requesterId, this.userRepository);
      const scoped = shopId ? { ...filter, shopId } : filter;
      const { results, totalCount } =
        await this.stockRequestRepository.list(scoped);
      return CommonResponses.OkResponse<PagedResults<StockRequest>>({
        results,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error(
        'an error occurred while listing stock requests',
        filter,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<
        PagedResults<StockRequest>
      >('An error occurred while listing stock requests');
    }
  }

  //raise a request for more stock
  async create(
    request: StockRequestRequest,
    requestedById: string,
  ): Promise<ApiResponseDto<StockRequest>> {
    try {
      const shop = await this.shopRepository.getById(request.shopId);
      if (!shop) {
        return CommonResponses.NotFoundResponse<StockRequest>('Shop not found');
      }

      const ids = request.items.map((i) => i.inventoryId);
      if (new Set(ids).size !== ids.length) {
        return CommonResponses.BadRequestResponse<StockRequest>(
          undefined,
          'The same item appears more than once in this request',
        );
      }

      const items: StockRequestItem[] = [];
      for (const line of request.items) {
        const inventory = await this.inventoryRepository.getById(
          line.inventoryId,
        );
        if (!inventory) {
          return CommonResponses.NotFoundResponse<StockRequest>(
            'One of the requested items no longer exists',
          );
        }
        items.push({
          inventoryId: inventory.id,
          inventoryInfoSnapshot: toInventoryInfo(inventory),
          quantity: line.quantity,
        });
      }

      const stockRequest = await this.stockRequestRepository.create({
        shopId: request.shopId,
        shopInfoSnapshot: toShopInfo(shop),
        items,
        notes: request.notes,
        requestedById,
      });
      return CommonResponses.CreatedResponse<StockRequest>(stockRequest);
    } catch (error) {
      this.logger.error(
        'an error occurred while creating stock request',
        request,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<StockRequest>(
        'An error occurred while creating stock request',
      );
    }
  }

  //approve a request: fulfils it immediately with a warehouse -> shop transfer
  async approve(
    id: string,
    reviewedById: string,
    review: StockRequestReview,
  ): Promise<ApiResponseDto<StockRequest>> {
    try {
      const stockRequest = await this.stockRequestRepository.getById(id);
      if (!stockRequest) {
        return CommonResponses.NotFoundResponse<StockRequest>(
          'Stock request not found',
        );
      }
      if (stockRequest.status !== StockRequestStatus.Pending) {
        return CommonResponses.BadRequestResponse<StockRequest>(
          undefined,
          'Only a pending stock request can be approved',
        );
      }

      // No partial fulfilment: every line must have enough warehouse stock
      // before any transfer is created, or none of them are.
      for (const item of stockRequest.items) {
        const inventory = await this.inventoryRepository.getById(
          item.inventoryId,
        );
        if (!inventory || inventory.quantity < item.quantity) {
          return CommonResponses.BadRequestResponse<StockRequest>(
            undefined,
            `${item.inventoryInfoSnapshot?.name ?? item.inventoryId} doesn't have enough stock in the warehouse (have ${inventory?.quantity ?? 0}, need ${item.quantity})`,
          );
        }
      }

      const transferIds: string[] = [];
      for (const item of stockRequest.items) {
        const transferCreated = await this.transferService.create(
          {
            toShopId: stockRequest.shopId,
            inventoryId: item.inventoryId,
            quantity: item.quantity,
          },
          reviewedById,
        );
        if (!transferCreated.data) {
          return CommonResponses.BadRequestResponse<StockRequest>(
            undefined,
            transferCreated.message ?? 'Could not fulfil this request',
          );
        }

        const transferCompleted = await this.transferService.complete(
          transferCreated.data.id,
          reviewedById,
        );
        if (!transferCompleted.data) {
          return CommonResponses.BadRequestResponse<StockRequest>(
            undefined,
            transferCompleted.message ?? 'Could not fulfil this request',
          );
        }
        transferIds.push(transferCreated.data.id);
      }

      const approved = await this.stockRequestRepository.approve(
        id,
        reviewedById,
        transferIds,
        review?.notes,
      );
      return CommonResponses.OkResponse<StockRequest>(approved);
    } catch (error) {
      this.logger.error(
        'an error occurred while approving stock request',
        { id, reviewedById },
        error,
      );
      return CommonResponses.InternalServerErrorResponse<StockRequest>(
        'An error occurred while approving stock request',
      );
    }
  }

  //reject a request
  async reject(
    id: string,
    reviewedById: string,
    review: StockRequestReview,
  ): Promise<ApiResponseDto<StockRequest>> {
    try {
      const stockRequest = await this.stockRequestRepository.getById(id);
      if (!stockRequest) {
        return CommonResponses.NotFoundResponse<StockRequest>(
          'Stock request not found',
        );
      }
      if (stockRequest.status !== StockRequestStatus.Pending) {
        return CommonResponses.BadRequestResponse<StockRequest>(
          undefined,
          'Only a pending stock request can be rejected',
        );
      }

      const rejected = await this.stockRequestRepository.reject(
        id,
        reviewedById,
        review?.notes,
      );
      return CommonResponses.OkResponse<StockRequest>(rejected);
    } catch (error) {
      this.logger.error(
        'an error occurred while rejecting stock request',
        { id, reviewedById },
        error,
      );
      return CommonResponses.InternalServerErrorResponse<StockRequest>(
        'An error occurred while rejecting stock request',
      );
    }
  }
}
