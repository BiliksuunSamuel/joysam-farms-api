import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ShopInventoryFilter } from 'src/dtos/shop-inventory/shop-inventory.filter.dto';
import { ShopInventoryRequest } from 'src/dtos/shop-inventory/shop-inventory.request.dto';
import { ShopInventoryStatus } from 'src/enums';
import { InventoryInfo } from 'src/models/inventory/inventory-info.model';
import { ShopInventory } from 'src/schemas/shop-inventory.schema';
import { generateId, toPaginationInfo } from 'src/utils';

@Injectable()
export class ShopInventoryRepository {
  constructor(
    @InjectModel(ShopInventory.name)
    private readonly shopInventoryRepository: Model<ShopInventory>,
  ) {}

  //get by id
  async getById(id: string): Promise<ShopInventory> {
    return await this.shopInventoryRepository.findOne({ id }).lean();
  }

  //get by shop + inventory item, to check for an existing assignment
  async getByShopAndInventory(
    shopId: string,
    inventoryId: string,
  ): Promise<ShopInventory> {
    return await this.shopInventoryRepository
      .findOne({ shopId, inventoryId })
      .lean();
  }

  //top items at a shop by expected retail value (quantity * snapshotted
  //price) - the snapshot means no join back to Inventory is needed
  async getTopItemsByValue(
    shopId: string,
    limit: number,
  ): Promise<{ label: string; quantity: number; revenue: number }[]> {
    const results = await this.shopInventoryRepository.aggregate([
      { $match: { shopId } },
      {
        $project: {
          label: '$inventoryInfoSnapshot.name',
          quantity: '$quantity',
          revenue: { $multiply: ['$quantity', '$inventoryInfoSnapshot.price'] },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: limit },
    ]);

    return results.map((r) => ({
      label: r.label,
      quantity: r.quantity,
      revenue: r.revenue,
    }));
  }

  //count of active items assigned to a shop, grouped by categoryId - joins
  //live to Inventory rather than trusting inventoryInfoSnapshot.categoryId,
  //since older snapshots may predate that field being captured
  async getActiveCategoryCounts(
    shopId: string,
  ): Promise<{ categoryId: string; count: number }[]> {
    const results = await this.shopInventoryRepository.aggregate([
      { $match: { shopId, status: ShopInventoryStatus.Active } },
      {
        $lookup: {
          from: 'inventories',
          localField: 'inventoryId',
          foreignField: 'id',
          as: 'inventory',
        },
      },
      { $unwind: { path: '$inventory', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          categoryId: {
            $ifNull: ['$inventory.categoryId', '$inventoryInfoSnapshot.categoryId'],
          },
        },
      },
      { $match: { categoryId: { $nin: [null, ''] } } },
      { $group: { _id: '$categoryId', count: { $sum: 1 } } },
    ]);

    return results.map((r) => ({ categoryId: r._id, count: r.count }));
  }

  //list, optionally scoped to a shop and/or an inventory item
  async list(
    filter: ShopInventoryFilter,
  ): Promise<{ results: ShopInventory[]; totalCount: number }> {
    const { page, pageSize } = toPaginationInfo(filter);
    const query: any = {};
    if (filter?.shopId) query.shopId = filter.shopId;
    if (filter?.inventoryId) query.inventoryId = filter.inventoryId;
    if (filter?.status) query.status = filter.status;

    const [results, totalCount] = await Promise.all([
      this.shopInventoryRepository
        .find(query)
        .sort({ createdAt: -1, _id: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      this.shopInventoryRepository.countDocuments(query),
    ]);

    return { results, totalCount };
  }

  //assign an inventory item to a shop
  async create(
    request: ShopInventoryRequest & { inventoryInfoSnapshot?: InventoryInfo },
  ): Promise<ShopInventory> {
    const res = await this.shopInventoryRepository.create({
      ...request,
      id: generateId(),
    });
    return await this.shopInventoryRepository.findById(res._id).lean();
  }

  //adjust the quantity of an existing assignment
  async updateQuantity(id: string, quantity: number): Promise<ShopInventory> {
    return await this.shopInventoryRepository
      .findOneAndUpdate({ id }, { $set: { quantity } }, { new: true })
      .lean();
  }

  //change whether this shop still carries the item
  async updateStatus(
    id: string,
    status: ShopInventoryStatus,
  ): Promise<ShopInventory> {
    return await this.shopInventoryRepository
      .findOneAndUpdate({ id }, { $set: { status } }, { new: true })
      .lean();
  }

  //unassign an inventory item from a shop
  async delete(id: string): Promise<ShopInventory> {
    return await this.shopInventoryRepository.findOneAndDelete({ id }).lean();
  }

  /**
   * Adjusts a shop's quantity of an item by a (positive or negative) delta,
   * creating the assignment (at `delta`, so this should only be called with
   * a positive delta when none exists yet) if this is the first time the
   * shop has received it.
   */
  async incrementQuantity(
    shopId: string,
    inventoryId: string,
    delta: number,
    inventoryInfoSnapshot: InventoryInfo,
  ): Promise<ShopInventory> {
    return await this.shopInventoryRepository
      .findOneAndUpdate(
        { shopId, inventoryId },
        {
          $inc: { quantity: delta },
          $setOnInsert: {
            id: generateId(),
            shopId,
            inventoryId,
            inventoryInfoSnapshot,
            status: ShopInventoryStatus.Active,
          },
        },
        { new: true, upsert: true },
      )
      .lean();
  }
}
