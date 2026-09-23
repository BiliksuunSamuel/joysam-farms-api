import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SupplierInventoryLedgerEntryFilter } from 'src/dtos/supplier/supplier-inventory-ledger-entry.filter.dto';
import { InventoryInfo } from 'src/models/inventory/inventory-info.model';
import { SupplierInventoryLedgerEntry } from 'src/schemas/supplier-inventory-ledger-entry.schema';
import { generateId, toPaginationInfo } from 'src/utils';

@Injectable()
export class SupplierInventoryLedgerEntryRepository {
  constructor(
    @InjectModel(SupplierInventoryLedgerEntry.name)
    private readonly supplierInventoryLedgerEntryRepository: Model<SupplierInventoryLedgerEntry>,
  ) {}

  //list, scoped by supplier, newest first
  async list(
    filter: SupplierInventoryLedgerEntryFilter,
  ): Promise<{ results: SupplierInventoryLedgerEntry[]; totalCount: number }> {
    const { page, pageSize } = toPaginationInfo(filter);
    const query: any = {};
    if (filter?.supplierId) query.supplierId = filter.supplierId;

    const [results, totalCount] = await Promise.all([
      this.supplierInventoryLedgerEntryRepository
        .find(query)
        .sort({ date: -1, createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      this.supplierInventoryLedgerEntryRepository.countDocuments(query),
    ]);

    return { results, totalCount };
  }

  //post an entry - entries are never edited after creation
  async create(entry: {
    supplierId: string;
    inventoryId: string;
    inventoryInfoSnapshot: InventoryInfo;
    quantity: number;
    expiryDate?: Date;
    referenceId: string;
  }): Promise<SupplierInventoryLedgerEntry> {
    const res = await this.supplierInventoryLedgerEntryRepository.create({
      ...entry,
      id: generateId(),
    });
    return await this.supplierInventoryLedgerEntryRepository
      .findById(res._id)
      .lean();
  }
}
