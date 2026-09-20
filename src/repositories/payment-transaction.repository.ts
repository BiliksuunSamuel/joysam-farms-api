import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PaymentTransactionFilter } from 'src/dtos/payment-transaction/payment-transaction.filter.dto';
import { PaymentTransactionTrendFilter } from 'src/dtos/payment-transaction/payment-transaction.trend.filter.dto';
import {
  PaymentTransactionStatus,
  PaymentTransactionTrendGroupBy,
} from 'src/enums';
import { PaymentAuthorization } from 'src/models/payment/payment-authorization.model';
import { PaymentTransaction } from 'src/schemas/payment-transaction.schema';
import { generateId, toPaginationInfo } from 'src/utils';

export type CreatePaymentTransactionRecord = {
  saleId: string;
  reference: string;
  shopId: string;
  amount: number;
  email: string;
  authorizationUrl: string;
};

export type PaymentTransactionStatusPatch = {
  paidAt?: Date;
  channel?: string;
  gatewayResponse?: string;
  failureReason?: string;
  paystackTransactionId?: number;
  currency?: string;
  fees?: number;
  ipAddress?: string;
  customerCode?: string;
  authorization?: PaymentAuthorization;
  attempts?: number;
};

@Injectable()
export class PaymentTransactionRepository {
  constructor(
    @InjectModel(PaymentTransaction.name)
    private readonly paymentTransactionRepository: Model<PaymentTransaction>,
  ) {}

  //get by id
  async getById(id: string): Promise<PaymentTransaction> {
    return await this.paymentTransactionRepository.findOne({ id }).lean();
  }

  //get by Paystack reference
  async getByReference(reference: string): Promise<PaymentTransaction> {
    return await this.paymentTransactionRepository
      .findOne({ reference })
      .lean();
  }

  //get by the sale it's paying for
  async getBySaleId(saleId: string): Promise<PaymentTransaction> {
    return await this.paymentTransactionRepository.findOne({ saleId }).lean();
  }

  async create(
    record: CreatePaymentTransactionRecord,
  ): Promise<PaymentTransaction> {
    const res = await this.paymentTransactionRepository.create({
      ...record,
      id: generateId(),
      status: PaymentTransactionStatus.Pending,
    });
    return await this.paymentTransactionRepository.findById(res._id).lean();
  }

  //list, optionally scoped by shop/status/channel
  async list(
    filter: PaymentTransactionFilter,
  ): Promise<{ results: PaymentTransaction[]; totalCount: number }> {
    const { page, pageSize } = toPaginationInfo(filter);
    const query: any = {};
    if (filter?.shopId) query.shopId = filter.shopId;
    if (filter?.status) query.status = filter.status;
    if (filter?.channel) query.channel = filter.channel;

    const [results, totalCount] = await Promise.all([
      this.paymentTransactionRepository
        .find(query)
        .sort({ createdAt: -1, _id: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      this.paymentTransactionRepository.countDocuments(query),
    ]);

    return { results, totalCount };
  }

  //value1 = count of all transactions in the bucket, value2 = how many
  //succeeded - mirrors SaleRepository.getTrend()'s time-based branch
  //exactly (same $dateToString formats), scoped down to just the time
  //groupings this domain needs (see PaymentTransactionTrendGroupBy).
  async getTrend(
    filter: PaymentTransactionTrendFilter,
  ): Promise<{ key: string; value1: number; value2: number }[]> {
    const match: any = {};
    if (filter?.shopId) match.shopId = filter.shopId;
    if (filter?.status) match.status = filter.status;
    if (filter?.channel) match.channel = filter.channel;
    if (filter?.startDate || filter?.endDate) {
      match.createdAt = {};
      if (filter.startDate) match.createdAt.$gte = new Date(filter.startDate);
      if (filter.endDate) match.createdAt.$lte = new Date(filter.endDate);
    }

    const group: any = {
      value1: { $sum: 1 },
      value2: {
        $sum: {
          $cond: [{ $eq: ['$status', PaymentTransactionStatus.Success] }, 1, 0],
        },
      },
    };
    switch (filter?.groupBy) {
      case PaymentTransactionTrendGroupBy.Hour:
        group._id = {
          $dateToString: { format: '%Y-%m-%dT%H:00', date: '$createdAt' },
        };
        break;
      case PaymentTransactionTrendGroupBy.Week:
        group._id = { $dateToString: { format: '%G-W%V', date: '$createdAt' } };
        break;
      case PaymentTransactionTrendGroupBy.Month:
        group._id = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
        break;
      case PaymentTransactionTrendGroupBy.Year:
        group._id = { $dateToString: { format: '%Y', date: '$createdAt' } };
        break;
      case PaymentTransactionTrendGroupBy.Day:
      default:
        group._id = {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
        };
        break;
    }

    const results = await this.paymentTransactionRepository.aggregate([
      { $match: match },
      { $group: group },
      { $sort: { _id: 1 } },
    ]);

    return results.map((r) => ({
      key: r._id,
      value1: r.value1,
      value2: r.value2,
    }));
  }

  //count + amount per status for a fixed date range - used by the Daily
  //Report, which needs the full status breakdown for one day rather than a
  //time-bucketed trend. shopId undefined = every shop combined.
  async getStatusBreakdown(
    shopId: string | undefined,
    startDate: Date,
    endDate: Date,
  ): Promise<
    { status: PaymentTransactionStatus; count: number; amount: number }[]
  > {
    const match: any = { createdAt: { $gte: startDate, $lt: endDate } };
    if (shopId) match.shopId = shopId;

    const results = await this.paymentTransactionRepository.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          amount: { $sum: '$amount' },
        },
      },
    ]);

    return results.map((r) => ({
      status: r._id,
      count: r.count,
      amount: r.amount,
    }));
  }

  // A denormalized mirror of the outcome already decided on Sale.status -
  // deliberately not a guarded/atomic write. It's safe to overwrite with
  // the same terminal value on every retry (see
  // PaymentTransactionService.confirmDigitalPayment, where the real
  // concurrency guard lives on Sale, not here).
  async updateStatus(
    reference: string,
    status: PaymentTransactionStatus,
    patch: PaymentTransactionStatusPatch = {},
  ): Promise<PaymentTransaction> {
    return await this.paymentTransactionRepository
      .findOneAndUpdate(
        { reference },
        { $set: { status, ...patch } },
        { new: true },
      )
      .lean();
  }
}
