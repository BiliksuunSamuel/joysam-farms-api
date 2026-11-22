import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DayCloseFilter } from 'src/dtos/day-close/day-close.filter.dto';
import { DayClose } from 'src/schemas/day-close.schema';
import { generateId, toPaginationInfo } from 'src/utils';

@Injectable()
export class DayCloseRepository {
  constructor(
    @InjectModel(DayClose.name)
    private readonly dayCloseRepository: Model<DayClose>,
  ) {}

  async getById(id: string): Promise<DayClose> {
    return await this.dayCloseRepository.findOne({ id }).lean();
  }

  async getForDay(
    shopId: string,
    cashierId: string,
    date: string,
  ): Promise<DayClose | null> {
    return await this.dayCloseRepository
      .findOne({ shopId, cashierId, date })
      .lean();
  }

  async list(
    filter: DayCloseFilter,
  ): Promise<{ results: DayClose[]; totalCount: number }> {
    const { page, pageSize } = toPaginationInfo(filter);
    const query: any = {};
    if (filter?.shopId) query.shopId = filter.shopId;
    if (filter?.cashierId) query.cashierId = filter.cashierId;
    if (filter?.startDate || filter?.endDate) {
      query.date = {};
      if (filter.startDate)
        query.date.$gte = new Date(filter.startDate).toISOString().slice(0, 10);
      if (filter.endDate)
        query.date.$lte = new Date(filter.endDate).toISOString().slice(0, 10);
    }
    const [results, totalCount] = await Promise.all([
      this.dayCloseRepository
        .find(query)
        .sort({ date: -1, createdAt: -1, _id: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      this.dayCloseRepository.countDocuments(query),
    ]);
    return { results, totalCount };
  }

  // Closing the same day again replaces the record rather than adding a
  // second one - revision says how many times it was counted.
  async upsert(
    shopId: string,
    cashierId: string,
    date: string,
    payload: Omit<
      DayClose,
      'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'revision'
    >,
  ): Promise<DayClose> {
    return await this.dayCloseRepository
      .findOneAndUpdate(
        { shopId, cashierId, date },
        {
          $set: { ...payload, updatedAt: new Date() },
          $inc: { revision: 1 },
          $setOnInsert: { id: generateId() },
        },
        { new: true, upsert: true },
      )
      .lean();
  }
}
