import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SupplierLedgerEntryFilter } from 'src/dtos/supplier/supplier-ledger-entry.filter.dto';
import { SupplierLedgerEntryType } from 'src/enums';
import { ShopInfo } from 'src/models/shop/shop-info.model';
import { SupplierLedgerEntry } from 'src/schemas/supplier-ledger-entry.schema';
import { generateId, toPaginationInfo } from 'src/utils';

@Injectable()
export class SupplierLedgerEntryRepository {
  constructor(
    @InjectModel(SupplierLedgerEntry.name)
    private readonly supplierLedgerEntryRepository: Model<SupplierLedgerEntry>,
  ) {}

  //get by id
  async getById(id: string): Promise<SupplierLedgerEntry> {
    return await this.supplierLedgerEntryRepository.findOne({ id }).lean();
  }

  //list, scoped by supplier, newest first
  async list(
    filter: SupplierLedgerEntryFilter,
  ): Promise<{ results: SupplierLedgerEntry[]; totalCount: number }> {
    const { page, pageSize } = toPaginationInfo(filter);
    const query: any = {};
    if (filter?.supplierId) query.supplierId = filter.supplierId;

    const [results, totalCount] = await Promise.all([
      this.supplierLedgerEntryRepository
        .find(query)
        .sort({ date: -1, createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      this.supplierLedgerEntryRepository.countDocuments(query),
    ]);

    return { results, totalCount };
  }

  //post an entry - entries are never edited after creation
  async create(entry: {
    supplierId: string;
    date?: Date;
    type: SupplierLedgerEntryType;
    amount: number;
    balanceAfter: number;
    referenceId?: string;
    shopId?: string;
    shopInfoSnapshot?: ShopInfo;
    paymentMethod?: string;
    reference?: string;
    description?: string;
    recordedById?: string;
  }): Promise<SupplierLedgerEntry> {
    const res = await this.supplierLedgerEntryRepository.create({
      ...entry,
      id: generateId(),
    });
    return await this.supplierLedgerEntryRepository.findById(res._id).lean();
  }

  //the supplier's current balance, computed by summing its ledger - never
  //cached. Positive once we owe money: a Bill adds, a Payment subtracts.
  //An Adjustment's amount is already signed (see the schema), so it's
  //summed as-is.
  async getBalance(supplierId: string): Promise<number> {
    const [totals] = await this.supplierLedgerEntryRepository.aggregate([
      { $match: { supplierId } },
      {
        $group: {
          _id: null,
          balance: {
            $sum: {
              $switch: {
                branches: [
                  {
                    case: { $eq: ['$type', SupplierLedgerEntryType.Bill] },
                    then: '$amount',
                  },
                  {
                    case: { $eq: ['$type', SupplierLedgerEntryType.Payment] },
                    then: { $multiply: ['$amount', -1] },
                  },
                ],
                default: '$amount',
              },
            },
          },
        },
      },
    ]);
    return totals?.balance ?? 0;
  }
}
