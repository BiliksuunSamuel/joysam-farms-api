import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/dtos/common/api.response.dto';
import { PagedResults } from 'src/dtos/common/paged.results.dto';
import { TransferFilter } from 'src/dtos/transfer/transfer.filter.dto';
import { TransferRequest } from 'src/dtos/transfer/transfer.request.dto';
import { TransferStatus } from 'src/enums';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { InventoryRepository } from 'src/repositories/inventory.repository';
import { SettingsRepository } from 'src/repositories/settings.repository';
import { ShopInventoryRepository } from 'src/repositories/shop-inventory.repository';
import { ShopRepository } from 'src/repositories/shop.repository';
import { TransferRepository } from 'src/repositories/transfer.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { Transfer } from 'src/schemas/transfer.schema';
import { resolveRequesterShopId, toInventoryInfo, toPaginationInfo, toShopInfo } from 'src/utils';

@Injectable()
export class TransferService {
  private readonly logger = new Logger(TransferService.name);
  constructor(
    private readonly transferRepository: TransferRepository,
    private readonly shopRepository: ShopRepository,
    private readonly inventoryRepository: InventoryRepository,
    private readonly shopInventoryRepository: ShopInventoryRepository,
    private readonly settingsRepository: SettingsRepository,
    private readonly userRepository: UserRepository,
  ) {}

  //get by id - a shop-tied requester can only see a transfer where their
  //shop is either the source or the destination
  async getById(id: string, requesterId: string): Promise<ApiResponseDto<Transfer>> {
    try {
      const transfer = await this.transferRepository.getById(id);
      if (!transfer) {
        return CommonResponses.NotFoundResponse<Transfer>('Transfer not found');
      }
      const shopId = await resolveRequesterShopId(requesterId, this.userRepository);
      if (shopId && transfer.fromShopId !== shopId && transfer.toShopId !== shopId) {
        return CommonResponses.NotFoundResponse<Transfer>('Transfer not found');
      }
      return CommonResponses.OkResponse<Transfer>(transfer);
    } catch (error) {
      this.logger.error(
        'an error occurred while getting transfer by id',
        id,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<Transfer>(
        'An error occurred while getting transfer by id',
      );
    }
  }

  //list, optionally scoped by source/destination shop, item or status - a
  //shop-tied requester always sees transfers where their shop is either side
  async list(
    filter: TransferFilter,
    requesterId: string,
  ): Promise<ApiResponseDto<PagedResults<Transfer>>> {
    try {
      const { page, pageSize } = toPaginationInfo(filter);
      const shopId = await resolveRequesterShopId(requesterId, this.userRepository);
      const { results, totalCount } =
        await this.transferRepository.list(filter, shopId ?? undefined);
      return CommonResponses.OkResponse<PagedResults<Transfer>>({
        results,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error(
        'an error occurred while listing transfers',
        filter,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<
        PagedResults<Transfer>
      >('An error occurred while listing transfers');
    }
  }

  //initiate a transfer - fromShopId omitted means "stock this shop from the warehouse"
  async create(
    request: TransferRequest,
    initiatedById: string,
  ): Promise<ApiResponseDto<Transfer>> {
    try {
      if (request.fromShopId && request.fromShopId === request.toShopId) {
        return CommonResponses.BadRequestResponse<Transfer>(
          undefined,
          'A shop cannot transfer stock to itself',
        );
      }

      const toShop = await this.shopRepository.getById(request.toShopId);
      if (!toShop) {
        return CommonResponses.NotFoundResponse<Transfer>(
          'Destination shop not found',
        );
      }

      const inventory = await this.inventoryRepository.getById(
        request.inventoryId,
      );
      if (!inventory) {
        return CommonResponses.NotFoundResponse<Transfer>(
          'Inventory item not found',
        );
      }

      let fromShopInfoSnapshot = undefined;
      if (request.fromShopId) {
        const fromShop = await this.shopRepository.getById(request.fromShopId);
        if (!fromShop) {
          return CommonResponses.NotFoundResponse<Transfer>(
            'Source shop not found',
          );
        }
        const sourceStock =
          await this.shopInventoryRepository.getByShopAndInventory(
            request.fromShopId,
            request.inventoryId,
          );
        if (!sourceStock || sourceStock.quantity < request.quantity) {
          return CommonResponses.BadRequestResponse<Transfer>(
            undefined,
            'The source shop does not have enough stock of this item',
          );
        }
        fromShopInfoSnapshot = toShopInfo(fromShop);
      } else if (inventory.quantity < request.quantity) {
        return CommonResponses.BadRequestResponse<Transfer>(
          undefined,
          'The warehouse does not have enough stock of this item',
        );
      }

      const transfer = await this.transferRepository.create({
        fromShopId: request.fromShopId,
        fromShopInfoSnapshot,
        toShopId: request.toShopId,
        toShopInfoSnapshot: toShopInfo(toShop),
        inventoryId: request.inventoryId,
        inventoryInfoSnapshot: toInventoryInfo(inventory),
        quantity: request.quantity,
        initiatedById,
      });

      // Shop-to-shop transfers can be configured to skip the approval step
      // entirely - warehouse-to-shop deliveries are never auto-completed here.
      if (request.fromShopId) {
        const settings = await this.settingsRepository.get();
        if (settings?.transfersRequireApproval === false) {
          return await this.complete(transfer.id, initiatedById);
        }
      }

      return CommonResponses.CreatedResponse<Transfer>(transfer);
    } catch (error) {
      this.logger.error(
        'an error occurred while initiating transfer',
        request,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<Transfer>(
        'An error occurred while initiating transfer',
      );
    }
  }

  //complete a pending transfer: actually moves the quantity
  async complete(
    id: string,
    approvedById: string,
  ): Promise<ApiResponseDto<Transfer>> {
    try {
      const transfer = await this.transferRepository.getById(id);
      if (!transfer) {
        return CommonResponses.NotFoundResponse<Transfer>('Transfer not found');
      }
      if (transfer.status !== TransferStatus.Pending) {
        return CommonResponses.BadRequestResponse<Transfer>(
          undefined,
          'Only a pending transfer can be completed',
        );
      }

      if (transfer.fromShopId) {
        const sourceStock =
          await this.shopInventoryRepository.getByShopAndInventory(
            transfer.fromShopId,
            transfer.inventoryId,
          );
        if (!sourceStock || sourceStock.quantity < transfer.quantity) {
          return CommonResponses.BadRequestResponse<Transfer>(
            undefined,
            'The source shop no longer has enough stock of this item',
          );
        }
        await this.shopInventoryRepository.incrementQuantity(
          transfer.fromShopId,
          transfer.inventoryId,
          -transfer.quantity,
          transfer.inventoryInfoSnapshot,
        );
      } else {
        const inventory = await this.inventoryRepository.getById(
          transfer.inventoryId,
        );
        if (!inventory || inventory.quantity < transfer.quantity) {
          return CommonResponses.BadRequestResponse<Transfer>(
            undefined,
            'The warehouse no longer has enough stock of this item',
          );
        }
        await this.inventoryRepository.incrementQuantity(
          transfer.inventoryId,
          -transfer.quantity,
        );
      }

      await this.shopInventoryRepository.incrementQuantity(
        transfer.toShopId,
        transfer.inventoryId,
        transfer.quantity,
        transfer.inventoryInfoSnapshot,
      );

      const completed = await this.transferRepository.complete(
        id,
        approvedById,
      );
      return CommonResponses.OkResponse<Transfer>(completed);
    } catch (error) {
      this.logger.error(
        'an error occurred while completing transfer',
        { id, approvedById },
        error,
      );
      return CommonResponses.InternalServerErrorResponse<Transfer>(
        'An error occurred while completing transfer',
      );
    }
  }

  //cancel a pending transfer - nothing to undo, since nothing has moved yet
  async cancel(
    id: string,
    approvedById: string,
  ): Promise<ApiResponseDto<Transfer>> {
    try {
      const transfer = await this.transferRepository.getById(id);
      if (!transfer) {
        return CommonResponses.NotFoundResponse<Transfer>('Transfer not found');
      }
      if (transfer.status !== TransferStatus.Pending) {
        return CommonResponses.BadRequestResponse<Transfer>(
          undefined,
          'Only a pending transfer can be cancelled',
        );
      }
      const cancelled = await this.transferRepository.cancel(id, approvedById);
      return CommonResponses.OkResponse<Transfer>(cancelled);
    } catch (error) {
      this.logger.error(
        'an error occurred while cancelling transfer',
        { id, approvedById },
        error,
      );
      return CommonResponses.InternalServerErrorResponse<Transfer>(
        'An error occurred while cancelling transfer',
      );
    }
  }
}
