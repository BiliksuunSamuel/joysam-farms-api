import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TransferFilter } from 'src/dtos/transfer/transfer.filter.dto';
import { TransferStatus } from 'src/enums';
import { InventoryInfo } from 'src/models/inventory/inventory-info.model';
import { ShopInfo } from 'src/models/shop/shop-info.model';
import { Transfer } from 'src/schemas/transfer.schema';
import { generateId, toPaginationInfo } from 'src/utils';

@Injectable()
export class TransferRepository {
  constructor(
    @InjectModel(Transfer.name)
    private readonly transferRepository: Model<Transfer>,
  ) {}

  //get by id
  async getById(id: string): Promise<Transfer> {
    return await this.transferRepository.findOne({ id }).lean();
  }

  //list, optionally scoped by source/destination shop, item or status.
  //`forcedShopId` (never client-controlled - see resolveRequesterShopId)
  //overrides fromShopId/toShopId entirely with "either side is this shop",
  //since a shop-tied employee cares about transfers moving stock in either
  //direction, not just ones they happen to have sent.
  async list(
    filter: TransferFilter,
    forcedShopId?: string,
  ): Promise<{ results: Transfer[]; totalCount: number }> {
    const { page, pageSize } = toPaginationInfo(filter);
    const query: any = {};
    if (forcedShopId) {
      query.$or = [{ fromShopId: forcedShopId }, { toShopId: forcedShopId }];
    } else {
      if (filter?.fromShopId) query.fromShopId = filter.fromShopId;
      if (filter?.toShopId) query.toShopId = filter.toShopId;
    }
    if (filter?.inventoryId) query.inventoryId = filter.inventoryId;
    if (filter?.status) query.status = filter.status;
    if (filter?.initiatedById) query.initiatedById = filter.initiatedById;
    if (filter?.approvedById) query.approvedById = filter.approvedById;

    const [results, totalCount] = await Promise.all([
      this.transferRepository
        .find(query)
        .sort({ createdAt: -1, _id: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      this.transferRepository.countDocuments(query),
    ]);

    return { results, totalCount };
  }

  //initiate a transfer (status Pending - no quantities move yet)
  async create(request: {
    fromShopId?: string;
    fromShopInfoSnapshot?: ShopInfo;
    toShopId: string;
    toShopInfoSnapshot: ShopInfo;
    inventoryId: string;
    inventoryInfoSnapshot: InventoryInfo;
    quantity: number;
    initiatedById: string;
  }): Promise<Transfer> {
    const res = await this.transferRepository.create({
      ...request,
      id: generateId(),
    });
    return await this.transferRepository.findById(res._id).lean();
  }

  //mark a transfer completed once its quantities have actually moved
  async complete(id: string, approvedById: string): Promise<Transfer> {
    return await this.transferRepository
      .findOneAndUpdate(
        { id },
        {
          $set: {
            status: TransferStatus.Completed,
            approvedById,
            completedAt: new Date(),
          },
        },
        { new: true },
      )
      .lean();
  }

  //how many transfers completed in a fixed date range - used by the Daily
  //Report's inventory movement section. shopId scoping mirrors list()'s own
  //forcedShopId: either side of the transfer counts for that shop.
  async countCompleted(
    shopId: string | undefined,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const query: any = {
      status: TransferStatus.Completed,
      completedAt: { $gte: startDate, $lt: endDate },
    };
    if (shopId) {
      query.$or = [{ fromShopId: shopId }, { toShopId: shopId }];
    }
    return await this.transferRepository.countDocuments(query);
  }

  //cancel a pending transfer (nothing to undo - it never moved anything)
  async cancel(id: string, approvedById: string): Promise<Transfer> {
    return await this.transferRepository
      .findOneAndUpdate(
        { id },
        { $set: { status: TransferStatus.Cancelled, approvedById } },
        { new: true },
      )
      .lean();
  }
}
