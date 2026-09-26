import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SaleFilter } from 'src/dtos/sale/sale.filter.dto';
import { SaleStatus } from 'src/enums';
import { SaleProfitItem } from 'src/models/sale/sale-profit-item.model';
import { SaleProfit } from 'src/schemas/sale-profit.schema';
import { generateId } from 'src/utils';

@Injectable()
export class SaleProfitRepository {
  constructor(
    @InjectModel(SaleProfit.name)
    private readonly saleProfitRepository: Model<SaleProfit>,
  ) {}

  //post an entry - entries are never edited after creation, see the schema's own comment
  async create(entry: {
    saleId: string;
    shopId: string;
    date: Date;
    items: SaleProfitItem[];
    revenue: number;
    cost: number;
    profit: number;
  }): Promise<SaleProfit> {
    const res = await this.saleProfitRepository.create({
      ...entry,
      id: generateId(),
    });
    return await this.saleProfitRepository.findById(res._id).lean();
  }

  //revenue/cost/profit summed over whatever's still a Completed sale as of
  //right now - joined live against the sales collection rather than
  //trusting a status stored here, so a sale voided after this entry was
  //recorded drops out of the total with zero extra bookkeeping
  async getSummary(
    filter: SaleFilter,
  ): Promise<{ revenue: number; cost: number; profit: number }> {
    const match: any = {};
    if (filter?.shopId) match.shopId = filter.shopId;
    if (filter?.startDate || filter?.endDate) {
      match.date = {};
      if (filter.startDate) match.date.$gte = new Date(filter.startDate);
      if (filter.endDate) match.date.$lte = new Date(filter.endDate);
    }

    const [totals] = await this.saleProfitRepository.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'sales',
          localField: 'saleId',
          foreignField: 'id',
          as: 'sale',
        },
      },
      { $unwind: '$sale' },
      { $match: { 'sale.status': SaleStatus.Completed } },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$revenue' },
          cost: { $sum: '$cost' },
          profit: { $sum: '$profit' },
        },
      },
    ]);

    return {
      revenue: totals?.revenue ?? 0,
      cost: totals?.cost ?? 0,
      profit: totals?.profit ?? 0,
    };
  }
}
