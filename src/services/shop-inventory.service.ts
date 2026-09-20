import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/dtos/common/api.response.dto';
import { PagedResults } from 'src/dtos/common/paged.results.dto';
import { ShopInventoryBreakdown } from 'src/dtos/shop-inventory/shop-inventory.breakdown.dto';
import { ShopInventoryBreakdownFilter } from 'src/dtos/shop-inventory/shop-inventory.breakdown.filter.dto';
import { ShopInventoryCategoryCount } from 'src/dtos/shop-inventory/shop-inventory.category-count.dto';
import { ShopInventoryCategoryCountsFilter } from 'src/dtos/shop-inventory/shop-inventory.category-counts.filter.dto';
import { ShopInventoryFilter } from 'src/dtos/shop-inventory/shop-inventory.filter.dto';
import { ShopInventoryQuantityRequest } from 'src/dtos/shop-inventory/shop-inventory.quantity.request.dto';
import { ShopInventoryRequest } from 'src/dtos/shop-inventory/shop-inventory.request.dto';
import { ShopInventoryStatusRequest } from 'src/dtos/shop-inventory/shop-inventory.status.request.dto';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { CategoryRepository } from 'src/repositories/category.repository';
import { InventoryRepository } from 'src/repositories/inventory.repository';
import { SettingsRepository } from 'src/repositories/settings.repository';
import { ShopInventoryRepository } from 'src/repositories/shop-inventory.repository';
import { ShopRepository } from 'src/repositories/shop.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { ShopInventory } from 'src/schemas/shop-inventory.schema';
import { resolveRequesterShopId, toInventoryInfo, toPaginationInfo } from 'src/utils';

@Injectable()
export class ShopInventoryService {
  private readonly logger = new Logger(ShopInventoryService.name);
  constructor(
    private readonly shopInventoryRepository: ShopInventoryRepository,
    private readonly shopRepository: ShopRepository,
    private readonly inventoryRepository: InventoryRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly settingsRepository: SettingsRepository,
    private readonly userRepository: UserRepository,
  ) {}

  //get by id
  async getById(id: string, requesterId: string): Promise<ApiResponseDto<ShopInventory>> {
    try {
      const shopInventory = await this.shopInventoryRepository.getById(id);
      if (!shopInventory) {
        return CommonResponses.NotFoundResponse<ShopInventory>(
          'Shop inventory assignment not found',
        );
      }
      const shopId = await resolveRequesterShopId(requesterId, this.userRepository);
      if (shopId && shopInventory.shopId !== shopId) {
        return CommonResponses.NotFoundResponse<ShopInventory>(
          'Shop inventory assignment not found',
        );
      }
      return CommonResponses.OkResponse<ShopInventory>(shopInventory);
    } catch (error) {
      this.logger.error(
        'an error occurred while getting shop inventory by id',
        id,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<ShopInventory>(
        'An error occurred while getting shop inventory by id',
      );
    }
  }

  // Quantity (value1) and expected retail value (value2) of the top items
  // at a shop, ranked by value and capped at `limit` so a full shop
  // inventory stays chart-friendly.
  async getBreakdown(
    filter: ShopInventoryBreakdownFilter,
    requesterId: string,
  ): Promise<ApiResponseDto<ShopInventoryBreakdown[]>> {
    try {
      // filter.limit arrives as a query string, not a number - Mongo's
      // $limit stage in the repository's aggregation rejects anything but
      // a real number, so this must coerce rather than just truthy-check.
      const parsedLimit = Number(filter?.limit);
      const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 8;
      const shopId = await resolveRequesterShopId(requesterId, this.userRepository);
      const rows = await this.shopInventoryRepository.getTopItemsByValue(
        shopId || filter.shopId,
        limit,
      );
      const breakdown: ShopInventoryBreakdown[] = rows.map((row) => ({
        label: row.label,
        value1: row.quantity,
        value2: row.revenue,
      }));
      return CommonResponses.OkResponse<ShopInventoryBreakdown[]>(breakdown);
    } catch (error) {
      this.logger.error(
        'an error occurred while getting the shop inventory breakdown',
        filter,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<ShopInventoryBreakdown[]>(
        'An error occurred while getting the shop inventory breakdown',
      );
    }
  }

  // count of active items at a shop, grouped by category - drives the
  // category filter chips on checkout, so a shop-scoped requester (e.g. a
  // cashier without inventory.view) still gets accurate counts, computed
  // here rather than on the client
  async getCategoryCounts(
    filter: ShopInventoryCategoryCountsFilter,
    requesterId: string,
  ): Promise<ApiResponseDto<ShopInventoryCategoryCount[]>> {
    try {
      const shopId = await resolveRequesterShopId(requesterId, this.userRepository);
      const rows = await this.shopInventoryRepository.getActiveCategoryCounts(
        shopId || filter.shopId,
      );
      const categories = await this.categoryRepository.getByIds(rows.map((r) => r.categoryId));
      const nameById = new Map(categories.map((c) => [c.id, c.name]));
      const counts: ShopInventoryCategoryCount[] = rows
        .map((row) => ({
          categoryId: row.categoryId,
          categoryName: nameById.get(row.categoryId) ?? '',
          count: row.count,
        }))
        .filter((row) => row.categoryName);
      return CommonResponses.OkResponse<ShopInventoryCategoryCount[]>(counts);
    } catch (error) {
      this.logger.error(
        'an error occurred while getting shop inventory category counts',
        filter,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<ShopInventoryCategoryCount[]>(
        'An error occurred while getting shop inventory category counts',
      );
    }
  }

  //list, optionally scoped to a shop and/or an inventory item - a
  //shop-tied requester is always forced to their own shop
  async list(
    filter: ShopInventoryFilter,
    requesterId: string,
  ): Promise<ApiResponseDto<PagedResults<ShopInventory>>> {
    try {
      const { page, pageSize } = toPaginationInfo(filter);
      const shopId = await resolveRequesterShopId(requesterId, this.userRepository);
      const scoped = shopId ? { ...filter, shopId } : filter;
      const { results, totalCount } =
        await this.shopInventoryRepository.list(scoped);

      // The stored snapshot may predate categoryId being captured, and the
      // requester (e.g. a shop-scoped cashier) may lack `inventory.view` to
      // resolve it themselves - so resolve it live here instead, which needs
      // no permission of its own since it's an internal lookup.
      const inventoryIds = [...new Set(results.map((r) => r.inventoryId))];
      const inventoryItems = await this.inventoryRepository.getByIds(inventoryIds);
      const categoryIdByInventoryId = new Map(
        inventoryItems.map((i) => [i.id, i.categoryId]),
      );
      const enriched = results.map((r) => ({
        ...r,
        inventoryInfoSnapshot: r.inventoryInfoSnapshot
          ? {
              ...r.inventoryInfoSnapshot,
              categoryId:
                categoryIdByInventoryId.get(r.inventoryId) ??
                r.inventoryInfoSnapshot.categoryId ??
                null,
            }
          : r.inventoryInfoSnapshot,
      }));

      return CommonResponses.OkResponse<PagedResults<ShopInventory>>({
        results: enriched,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error(
        'an error occurred while listing shop inventory',
        filter,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<
        PagedResults<ShopInventory>
      >('An error occurred while listing shop inventory');
    }
  }

  //assign an inventory item to a shop
  async create(
    request: ShopInventoryRequest,
  ): Promise<ApiResponseDto<ShopInventory>> {
    try {
      const shop = await this.shopRepository.getById(request.shopId);
      if (!shop) {
        return CommonResponses.NotFoundResponse<ShopInventory>(
          'Shop not found',
        );
      }

      const inventory = await this.inventoryRepository.getById(
        request.inventoryId,
      );
      if (!inventory) {
        return CommonResponses.NotFoundResponse<ShopInventory>(
          'Inventory item not found',
        );
      }

      const existing = await this.shopInventoryRepository.getByShopAndInventory(
        request.shopId,
        request.inventoryId,
      );
      if (existing) {
        return CommonResponses.ConflictResponse<ShopInventory>(
          'This inventory item is already assigned to this shop',
        );
      }

      const quantity = request.quantity ?? 0;
      if (quantity > 0) {
        if (inventory.quantity < quantity) {
          return CommonResponses.BadRequestResponse<ShopInventory>(
            undefined,
            'The warehouse does not have enough stock of this item',
          );
        }
        await this.inventoryRepository.incrementQuantity(
          request.inventoryId,
          -quantity,
        );
      }

      const shopInventory = await this.shopInventoryRepository.create({
        ...request,
        quantity,
        inventoryInfoSnapshot: toInventoryInfo(inventory),
      });
      return CommonResponses.CreatedResponse<ShopInventory>(shopInventory);
    } catch (error) {
      this.logger.error(
        'an error occurred while assigning inventory to shop',
        request,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<ShopInventory>(
        'An error occurred while assigning inventory to shop',
      );
    }
  }

  //adjust the quantity of an existing assignment
  async updateQuantity(
    id: string,
    request: ShopInventoryQuantityRequest,
  ): Promise<ApiResponseDto<ShopInventory>> {
    try {
      const settings = await this.settingsRepository.get();
      if (settings?.stockAdjustmentsRequireReason && !request.reason?.trim()) {
        return CommonResponses.BadRequestResponse<ShopInventory>(
          undefined,
          'A reason is required for this adjustment',
        );
      }

      const shopInventory = await this.shopInventoryRepository.updateQuantity(
        id,
        request.quantity,
      );
      if (!shopInventory) {
        return CommonResponses.NotFoundResponse<ShopInventory>(
          'Shop inventory assignment not found',
        );
      }
      return CommonResponses.OkResponse<ShopInventory>(shopInventory);
    } catch (error) {
      this.logger.error(
        'an error occurred while updating shop inventory quantity',
        { id, request },
        error,
      );
      return CommonResponses.InternalServerErrorResponse<ShopInventory>(
        'An error occurred while updating shop inventory quantity',
      );
    }
  }

  //change whether this shop still carries the item
  async updateStatus(
    id: string,
    request: ShopInventoryStatusRequest,
  ): Promise<ApiResponseDto<ShopInventory>> {
    try {
      const shopInventory = await this.shopInventoryRepository.updateStatus(
        id,
        request.status,
      );
      if (!shopInventory) {
        return CommonResponses.NotFoundResponse<ShopInventory>(
          'Shop inventory assignment not found',
        );
      }
      return CommonResponses.OkResponse<ShopInventory>(shopInventory);
    } catch (error) {
      this.logger.error(
        'an error occurred while updating shop inventory status',
        { id, request },
        error,
      );
      return CommonResponses.InternalServerErrorResponse<ShopInventory>(
        'An error occurred while updating shop inventory status',
      );
    }
  }

  //unassign an inventory item from a shop
  async delete(id: string): Promise<ApiResponseDto<ShopInventory>> {
    try {
      const shopInventory = await this.shopInventoryRepository.delete(id);
      if (!shopInventory) {
        return CommonResponses.NotFoundResponse<ShopInventory>(
          'Shop inventory assignment not found',
        );
      }
      return CommonResponses.OkResponse<ShopInventory>(shopInventory);
    } catch (error) {
      this.logger.error(
        'an error occurred while deleting shop inventory',
        id,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<ShopInventory>(
        'An error occurred while deleting shop inventory',
      );
    }
  }
}
