import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VendorLedgerEntryFilter } from 'src/dtos/vendor/vendor-ledger-entry.filter.dto';
import { VendorLedgerEntryType } from 'src/enums';
import { ShopInfo } from 'src/models/shop/shop-info.model';
import { VendorLedgerEntry } from 'src/schemas/vendor-ledger-entry.schema';
import { generateId, toPaginationInfo } from 'src/utils';

@Injectable()
export class VendorLedgerEntryRepository {
  constructor(
    @InjectModel(VendorLedgerEntry.name)
    private readonly vendorLedgerEntryRepository: Model<VendorLedgerEntry>,
  ) {}

  //get by id
  async getById(id: string): Promise<VendorLedgerEntry> {
    return await this.vendorLedgerEntryRepository.findOne({ id }).lean();
  }

  //list, scoped by vendor, newest first
  async list(
    filter: VendorLedgerEntryFilter,
  ): Promise<{ results: VendorLedgerEntry[]; totalCount: number }> {
    const { page, pageSize } = toPaginationInfo(filter);
    const query: any = {};
    if (filter?.vendorId) query.vendorId = filter.vendorId;

    const [results, totalCount] = await Promise.all([
      this.vendorLedgerEntryRepository
        .find(query)
        .sort({ date: -1, createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      this.vendorLedgerEntryRepository.countDocuments(query),
    ]);

    return { results, totalCount };
  }

  //post an entry - entries are never edited after creation, other than a
  //Charge's outstandingAmount as payments are allocated against it (see
  //applyPayment below)
  async create(entry: {
    vendorId: string;
    date?: Date;
    type: VendorLedgerEntryType;
    amount: number;
    balanceAfter: number;
    dueDate?: Date;
    outstandingAmount?: number;
    referenceId?: string;
    shopId?: string;
    shopInfoSnapshot?: ShopInfo;
    paymentMethod?: string;
    reference?: string;
    description?: string;
    recordedById?: string;
  }): Promise<VendorLedgerEntry> {
    const res = await this.vendorLedgerEntryRepository.create({
      ...entry,
      id: generateId(),
    });
    return await this.vendorLedgerEntryRepository.findById(res._id).lean();
  }

  //the vendor's current balance, computed by summing its ledger - never
  //cached. Negative once they owe money: a Charge subtracts, a Payment
  //adds, same as a customer's own statement would read it. An Adjustment's
  //amount is already signed (see the schema), so it's summed as-is.
  async getBalance(vendorId: string): Promise<number> {
    const [totals] = await this.vendorLedgerEntryRepository.aggregate([
      { $match: { vendorId } },
      {
        $group: {
          _id: null,
          balance: {
            $sum: {
              $switch: {
                branches: [
                  {
                    case: { $eq: ['$type', VendorLedgerEntryType.Charge] },
                    then: { $multiply: ['$amount', -1] },
                  },
                  {
                    case: { $eq: ['$type', VendorLedgerEntryType.Payment] },
                    then: '$amount',
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

  //unpaid charges, oldest due date first - the FIFO order payments are
  //allocated against
  async getOutstandingCharges(vendorId: string): Promise<VendorLedgerEntry[]> {
    return await this.vendorLedgerEntryRepository
      .find({
        vendorId,
        type: VendorLedgerEntryType.Charge,
        outstandingAmount: { $gt: 0 },
      })
      .sort({ dueDate: 1, createdAt: 1 })
      .lean();
  }

  //reduce how much of a specific charge remains unpaid, as a payment is
  //allocated against it
  async reduceOutstanding(id: string, by: number): Promise<VendorLedgerEntry> {
    return await this.vendorLedgerEntryRepository
      .findOneAndUpdate(
        { id },
        { $inc: { outstandingAmount: -by } },
        { new: true },
      )
      .lean();
  }

  //real, invoice-level aging: each unpaid charge's outstanding amount,
  //bucketed by how overdue its dueDate is as of `asOf`
  async getAging(
    vendorId: string,
    asOf: Date,
  ): Promise<{ current: number; days1to30: number; days31to60: number; daysOver60: number }> {
    const charges = await this.getOutstandingCharges(vendorId);
    const aging = { current: 0, days1to30: 0, days31to60: 0, daysOver60: 0 };
    for (const charge of charges) {
      const daysOverdue = charge.dueDate
        ? Math.floor((asOf.getTime() - new Date(charge.dueDate).getTime()) / 86_400_000)
        : -1;
      if (daysOverdue <= 0) aging.current += charge.outstandingAmount;
      else if (daysOverdue <= 30) aging.days1to30 += charge.outstandingAmount;
      else if (daysOverdue <= 60) aging.days31to60 += charge.outstandingAmount;
      else aging.daysOver60 += charge.outstandingAmount;
    }
    return aging;
  }
}
