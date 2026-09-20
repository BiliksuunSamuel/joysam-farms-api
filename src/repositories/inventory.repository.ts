import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import { InventoryRequest } from 'src/dtos/inventory/inventory.request.dto';
import { Inventory } from 'src/schemas/inventory.schema';
import { InventoryUtilsService } from 'src/services/inventory-utils.service';
import { generateId, toPaginationInfo } from 'src/utils';

@Injectable()
export class InventoryRepository {
  constructor(
    @InjectModel(Inventory.name)
    private readonly inventoryRepository: Model<Inventory>,
    private readonly inventoryUtilsService: InventoryUtilsService,
  ) {}

  //get by id
  async getById(id: string): Promise<Inventory> {
    return await this.inventoryRepository.findOne({ id }).lean();
  }

  //batch get by id, for enriching a list of records that each reference one
  async getByIds(ids: string[]): Promise<Inventory[]> {
    if (!ids.length) return [];
    return await this.inventoryRepository.find({ id: { $in: ids } }).lean();
  }

  //get by barcode, for a scan-to-lookup flow
  async getByBarcode(barcode: string): Promise<Inventory> {
    return await this.inventoryRepository.findOne({ barcode }).lean();
  }

  //whether any inventory item is currently assigned this category (used to
  //block deleting it)
  async existsByCategoryId(categoryId: string): Promise<boolean> {
    return await this.inventoryRepository.exists({ categoryId }).then(Boolean);
  }

  //list, with optional search over name
  async list(
    filter: BaseFilter,
  ): Promise<{ results: Inventory[]; totalCount: number }> {
    const { page, pageSize } = toPaginationInfo(filter);
    const query: any = {};
    if (filter?.query) {
      query.name = new RegExp(filter.query, 'i');
    }

    const [results, totalCount] = await Promise.all([
      this.inventoryRepository
        .find(query)
        .sort({ createdAt: -1, _id: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      this.inventoryRepository.countDocuments(query),
    ]);

    return { results, totalCount };
  }

  //quantity + expected revenue (quantity * price), grouped by category -
  //categoryName isn't stored on Inventory, so this returns the raw
  //categoryId; the service resolves names via CategoryRepository, the same
  //way list()/getById() already do
  async getStockBreakdownByCategory(
    categoryId?: string,
  ): Promise<{ categoryId: string; quantity: number; revenue: number }[]> {
    const match: any = {};
    if (categoryId) match.categoryId = categoryId;

    const results = await this.inventoryRepository.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$categoryId',
          quantity: { $sum: '$quantity' },
          revenue: { $sum: { $multiply: ['$quantity', '$price'] } },
        },
      },
    ]);

    return results.map((r) => ({
      categoryId: r._id,
      quantity: r.quantity,
      revenue: r.revenue,
    }));
  }

  //quantity + expected revenue (quantity * price) per product - no
  //grouping needed, one row per item
  async getStockBreakdownByProduct(
    categoryId?: string,
  ): Promise<{ label: string; quantity: number; revenue: number }[]> {
    const query: any = {};
    if (categoryId) query.categoryId = categoryId;

    const items = await this.inventoryRepository
      .find(query, { name: 1, quantity: 1, price: 1, _id: 0 })
      .lean();

    return items.map((item) => ({
      label: item.name,
      quantity: item.quantity,
      revenue: item.quantity * item.price,
    }));
  }

  //create inventory item, with a freshly generated serialNumber + barcode
  async create(request: InventoryRequest): Promise<Inventory> {
    const serialNumber = await this.generateUniqueSerialNumber();
    const barcode = this.inventoryUtilsService.generateBarcode(serialNumber);
    const res = await this.inventoryRepository.create({
      ...request,
      serialNumber,
      barcode,
      id: generateId(),
    });
    return await this.inventoryRepository.findById(res._id).lean();
  }

  //update inventory item (serialNumber/barcode never change once assigned)
  async update(id: string, request: InventoryRequest): Promise<Inventory> {
    return await this.inventoryRepository
      .findOneAndUpdate({ id }, { $set: request }, { new: true })
      .lean();
  }

  //delete inventory item
  async delete(id: string): Promise<Inventory> {
    return await this.inventoryRepository.findOneAndDelete({ id }).lean();
  }

  //adjust the warehouse quantity by a (positive or negative) delta
  async incrementQuantity(id: string, delta: number): Promise<Inventory> {
    return await this.inventoryRepository
      .findOneAndUpdate({ id }, { $inc: { quantity: delta } }, { new: true })
      .lean();
  }

  private async generateUniqueSerialNumber(): Promise<string> {
    let serialNumber = this.inventoryUtilsService.generateSerialNumber();
    while (await this.inventoryRepository.exists({ serialNumber })) {
      serialNumber = this.inventoryUtilsService.generateSerialNumber();
    }
    return serialNumber;
  }
}
