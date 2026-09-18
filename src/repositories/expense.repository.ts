import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExpenseFilter } from 'src/dtos/expense/expense.filter.dto';
import { ExpenseRequest } from 'src/dtos/expense/expense.request.dto';
import { ExpenseTrendFilter } from 'src/dtos/expense/expense.trend.filter.dto';
import { ExpenseStatus, ExpenseTrendGroupBy } from 'src/enums';
import { ShopInfo } from 'src/models/shop/shop-info.model';
import { Expense } from 'src/schemas/expense.schema';
import { generateId, toPaginationInfo } from 'src/utils';

@Injectable()
export class ExpenseRepository {
  constructor(
    @InjectModel(Expense.name)
    private readonly expenseRepository: Model<Expense>,
  ) {}

  //get by id
  async getById(id: string): Promise<Expense> {
    return await this.expenseRepository.findOne({ id }).lean();
  }

  //list, optionally scoped by shop/category/status, with search over description/payee
  async list(
    filter: ExpenseFilter,
  ): Promise<{ results: Expense[]; totalCount: number }> {
    const { page, pageSize } = toPaginationInfo(filter);
    const query: any = {};
    if (filter?.shopId) query.shopId = filter.shopId;
    if (filter?.category) query.category = filter.category;
    if (filter?.status) query.status = filter.status;
    if (filter?.query) {
      const regex = new RegExp(filter.query, 'i');
      query.$or = [{ description: regex }, { payee: regex }];
    }

    const [results, totalCount] = await Promise.all([
      this.expenseRepository
        .find(query)
        .sort({ date: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      this.expenseRepository.countDocuments(query),
    ]);

    return { results, totalCount };
  }

  // Spending trend - value1 is total amount, value2 is number of expenses,
  // per bucket. Buckets on `date` (the accounting date), not `createdAt`
  // (when the record was entered) - those can differ, e.g. a rent expense
  // logged today for last month.
  async getTrend(
    filter: ExpenseTrendFilter,
  ): Promise<{ key: string; label: string; value1: number; value2: number }[]> {
    const match: any = {};
    if (filter?.shopId) match.shopId = filter.shopId;
    if (filter?.category) match.category = filter.category;
    if (filter?.status) match.status = filter.status;
    if (filter?.startDate || filter?.endDate) {
      match.date = {};
      if (filter.startDate) match.date.$gte = new Date(filter.startDate);
      if (filter.endDate) match.date.$lte = new Date(filter.endDate);
    }

    const group: any = {
      value1: { $sum: '$amount' },
      value2: { $sum: 1 },
    };
    switch (filter?.groupBy) {
      case ExpenseTrendGroupBy.Week:
        group._id = { $dateToString: { format: '%G-W%V', date: '$date' } };
        break;
      case ExpenseTrendGroupBy.Month:
        group._id = { $dateToString: { format: '%Y-%m', date: '$date' } };
        break;
      case ExpenseTrendGroupBy.Day:
      default:
        group._id = { $dateToString: { format: '%Y-%m-%d', date: '$date' } };
        break;
    }

    const results = await this.expenseRepository.aggregate([
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

  //record an expense
  async create(
    request: ExpenseRequest & {
      shopInfoSnapshot?: ShopInfo;
      recordedById: string;
    },
  ): Promise<Expense> {
    const res = await this.expenseRepository.create({
      ...request,
      id: generateId(),
    });
    return await this.expenseRepository.findById(res._id).lean();
  }

  //update expense - shopId/shopInfoSnapshot are re-resolved by the service
  //on every update (null clears the association back to head office), so
  //this always applies the full request as given, recordedById excepted
  async update(
    id: string,
    request: Omit<ExpenseRequest, 'shopId'> & {
      shopId: string | null;
      shopInfoSnapshot: ShopInfo | null;
    },
  ): Promise<Expense> {
    return await this.expenseRepository
      .findOneAndUpdate({ id }, { $set: request }, { new: true })
      .lean();
  }

  //mark an expense paid/pending
  async updateStatus(id: string, status: ExpenseStatus): Promise<Expense> {
    return await this.expenseRepository
      .findOneAndUpdate({ id }, { $set: { status } }, { new: true })
      .lean();
  }

  //delete expense
  async delete(id: string): Promise<Expense> {
    return await this.expenseRepository.findOneAndDelete({ id }).lean();
  }
}
