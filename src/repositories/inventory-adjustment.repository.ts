import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InventoryAdjustment } from 'src/schemas/inventory-adjustment.schema';
import { generateId } from 'src/utils';

@Injectable()
export class InventoryAdjustmentRepository {
  constructor(
    @InjectModel(InventoryAdjustment.name)
    private readonly inventoryAdjustmentRepository: Model<InventoryAdjustment>,
  ) {}

  //post an entry - entries are never edited after creation
  async create(entry: {
    inventoryId: string;
    quantityBefore: number;
    quantityAfter: number;
    delta: number;
    date?: Date;
    note?: string;
    performedById: string;
    supplierId?: string;
  }): Promise<InventoryAdjustment> {
    const res = await this.inventoryAdjustmentRepository.create({
      ...entry,
      id: generateId(),
    });
    return await this.inventoryAdjustmentRepository.findById(res._id).lean();
  }

  //most recent adjustments for one item, for the product detail page
  async listByInventoryId(
    inventoryId: string,
    limit = 10,
  ): Promise<InventoryAdjustment[]> {
    return await this.inventoryAdjustmentRepository
      .find({ inventoryId })
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      .lean();
  }
}
