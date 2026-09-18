import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LedgerEntryFilter } from 'src/dtos/ledger-entry/ledger-entry.filter.dto';
import { LedgerTrendFilter } from 'src/dtos/ledger-entry/ledger.trend.filter.dto';
import { LedgerEntryType, LedgerSource, LedgerTrendGroupBy } from 'src/enums';
import { LedgerEntry } from 'src/schemas/ledger-entry.schema';
import { generateId, toPaginationInfo } from 'src/utils';

@Injectable()
export class LedgerEntryRepository {
  constructor(
    @InjectModel(LedgerEntry.name)
    private readonly ledgerEntryRepository: Model<LedgerEntry>,
  ) {}

  //get by id
  async getById(id: string): Promise<LedgerEntry> {
    return await this.ledgerEntryRepository.findOne({ id }).lean();
  }

  //list, optionally scoped by shop/wallet/type/source
  async list(
    filter: LedgerEntryFilter,
  ): Promise<{ results: LedgerEntry[]; totalCount: number }> {
    const { page, pageSize } = toPaginationInfo(filter);
    const query: any = {};
    if (filter?.shopId) query.shopId = filter.shopId;
    if (filter?.walletId) query.walletId = filter.walletId;
    if (filter?.type) query.type = filter.type;
    if (filter?.source) query.source = filter.source;

    const [results, totalCount] = await Promise.all([
      this.ledgerEntryRepository
        .find(query)
        .sort({ createdAt: -1, _id: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      this.ledgerEntryRepository.countDocuments(query),
    ]);

    return { results, totalCount };
  }

  //post an entry (append-only - entries are never edited after creation)
  async create(request: {
    walletId: string;
    shopId: string;
    type: LedgerEntryType;
    source: LedgerSource;
    referenceId?: string;
    amount: number;
    balanceAfter: number;
    description?: string;
    recordedById?: string;
  }): Promise<LedgerEntry> {
    const res = await this.ledgerEntryRepository.create({
      ...request,
      id: generateId(),
    });
    return await this.ledgerEntryRepository.findById(res._id).lean();
  }

  //cash flow trend for a shop's wallet - value1 is inflow (credits), value2
  //is outflow (debits) per bucket, so the net position of each period is
  //value1 - value2
  async getTrend(
    filter: LedgerTrendFilter,
  ): Promise<{ key: string; label: string; value1: number; value2: number }[]> {
    const match: any = {};
    if (filter?.shopId) match.shopId = filter.shopId;
    if (filter?.startDate || filter?.endDate) {
      match.createdAt = {};
      if (filter.startDate) match.createdAt.$gte = new Date(filter.startDate);
      if (filter.endDate) match.createdAt.$lte = new Date(filter.endDate);
    }

    const group: any = {
      value1: {
        $sum: {
          $cond: [{ $eq: ['$type', LedgerEntryType.Credit] }, '$amount', 0],
        },
      },
      value2: {
        $sum: {
          $cond: [{ $eq: ['$type', LedgerEntryType.Debit] }, '$amount', 0],
        },
      },
    };
    switch (filter?.groupBy) {
      case LedgerTrendGroupBy.Week:
        group._id = { $dateToString: { format: '%G-W%V', date: '$createdAt' } };
        break;
      case LedgerTrendGroupBy.Month:
        group._id = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
        break;
      case LedgerTrendGroupBy.Day:
      default:
        group._id = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
        break;
    }

    const results = await this.ledgerEntryRepository.aggregate([
      { $match: match },
      { $group: group },
      { $sort: { _id: 1 } },
    ]);

    return results.map((r) => ({
      key: r._id,
      label: r._id,
      value1: r.value1,
      value2: r.value2,
    }));
  }

  //the wallet's current balance, computed by summing its ledger - never cached
  async getBalance(walletId: string): Promise<number> {
    const [totals] = await this.ledgerEntryRepository.aggregate([
      { $match: { walletId } },
      {
        $group: {
          _id: null,
          balance: {
            $sum: {
              $cond: [
                { $eq: ['$type', LedgerEntryType.Credit] },
                '$amount',
                { $multiply: ['$amount', -1] },
              ],
            },
          },
        },
      },
    ]);
    return totals?.balance ?? 0;
  }
}
