import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StockRequestFilter } from 'src/dtos/stock-request/stock-request.filter.dto';
import { StockRequestTrendFilter } from 'src/dtos/stock-request/stock-request.trend.filter.dto';
import { StockRequestStatus, StockRequestTrendGroupBy } from 'src/enums';
import { ShopInfo } from 'src/models/shop/shop-info.model';
import { StockRequestItem } from 'src/models/stock-request/stock-request-item.model';
import { StockRequest } from 'src/schemas/stock-request.schema';
import { generateId, toPaginationInfo } from 'src/utils';

@Injectable()
export class StockRequestRepository {
  constructor(
    @InjectModel(StockRequest.name)
    private readonly stockRequestRepository: Model<StockRequest>,
  ) {}

  //get by id
  async getById(id: string): Promise<StockRequest> {
    return await this.stockRequestRepository.findOne({ id }).lean();
  }

  //list, optionally scoped by shop, item or status
  async list(
    filter: StockRequestFilter,
  ): Promise<{ results: StockRequest[]; totalCount: number }> {
    const { page, pageSize } = toPaginationInfo(filter);
    const query: any = {};
    if (filter?.shopId) query.shopId = filter.shopId;
    if (filter?.inventoryId) query['items.inventoryId'] = filter.inventoryId;
    if (filter?.status) query.status = filter.status;

    const [results, totalCount] = await Promise.all([
      this.stockRequestRepository
        .find(query)
        .sort({ createdAt: -1, _id: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      this.stockRequestRepository.countDocuments(query),
    ]);

    return { results, totalCount };
  }

  //request activity trend for a shop or person - value1 is requests raised
  //(or reviewed, if scoped by reviewedById), value2 is how many of those
  //were approved, per bucket
  async getTrend(
    filter: StockRequestTrendFilter,
  ): Promise<{ key: string; label: string; value1: number; value2: number }[]> {
    const match: any = {};
    if (filter?.shopId) match.shopId = filter.shopId;
    if (filter?.requestedById) match.requestedById = filter.requestedById;
    if (filter?.reviewedById) match.reviewedById = filter.reviewedById;
    if (filter?.startDate || filter?.endDate) {
      match.createdAt = {};
      if (filter.startDate) match.createdAt.$gte = new Date(filter.startDate);
      if (filter.endDate) match.createdAt.$lte = new Date(filter.endDate);
    }

    const group: any = {
      value1: { $sum: 1 },
      value2: {
        $sum: {
          $cond: [{ $eq: ['$status', StockRequestStatus.Approved] }, 1, 0],
        },
      },
    };
    switch (filter?.groupBy) {
      case StockRequestTrendGroupBy.Week:
        group._id = { $dateToString: { format: '%G-W%V', date: '$createdAt' } };
        break;
      case StockRequestTrendGroupBy.Month:
        group._id = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
        break;
      case StockRequestTrendGroupBy.Day:
      default:
        group._id = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
        break;
    }

    const results = await this.stockRequestRepository.aggregate([
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

  //raise a request (status Pending)
  async create(request: {
    shopId: string;
    shopInfoSnapshot: ShopInfo;
    items: StockRequestItem[];
    notes?: string;
    requestedById: string;
  }): Promise<StockRequest> {
    const res = await this.stockRequestRepository.create({
      ...request,
      id: generateId(),
    });
    return await this.stockRequestRepository.findById(res._id).lean();
  }

  //approve a request, linking the Transfers (one per line) that fulfilled it
  async approve(
    id: string,
    reviewedById: string,
    transferIds: string[],
    notes?: string,
  ): Promise<StockRequest> {
    return await this.stockRequestRepository
      .findOneAndUpdate(
        { id },
        {
          $set: {
            status: StockRequestStatus.Approved,
            reviewedById,
            transferIds,
            ...(notes ? { notes } : {}),
          },
        },
        { new: true },
      )
      .lean();
  }

  //reject a request
  async reject(
    id: string,
    reviewedById: string,
    notes?: string,
  ): Promise<StockRequest> {
    return await this.stockRequestRepository
      .findOneAndUpdate(
        { id },
        {
          $set: {
            status: StockRequestStatus.Rejected,
            reviewedById,
            ...(notes ? { notes } : {}),
          },
        },
        { new: true },
      )
      .lean();
  }
}
