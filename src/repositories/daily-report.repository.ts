import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DailyReportFilter } from 'src/dtos/daily-report/daily-report.filter.dto';
import { DailyReport } from 'src/schemas/daily-report.schema';
import { generateId, toPaginationInfo } from 'src/utils';

export type DailyReportSections = {
  shopInfoSnapshot: DailyReport['shopInfoSnapshot'];
  sales: DailyReport['sales'];
  cashFlow: DailyReport['cashFlow'];
  payments: DailyReport['payments'];
  expenses: DailyReport['expenses'];
  inventoryMovement: DailyReport['inventoryMovement'];
};

@Injectable()
export class DailyReportRepository {
  constructor(
    @InjectModel(DailyReport.name)
    private readonly dailyReportRepository: Model<DailyReport>,
  ) {}

  //idempotent - safe for both the nightly cron and every manual regenerate
  //call. Always replaces the full document for that (shopId, date).
  async upsert(
    shopId: string | null,
    date: Date,
    payload: DailyReportSections,
  ): Promise<DailyReport> {
    return await this.dailyReportRepository
      .findOneAndUpdate(
        { shopId, date },
        {
          $set: { ...payload, generatedAt: new Date() },
          $setOnInsert: { id: generateId() },
        },
        { upsert: true, new: true },
      )
      .lean();
  }

  async getByShopAndDate(
    shopId: string | null,
    date: Date,
  ): Promise<DailyReport> {
    return await this.dailyReportRepository.findOne({ shopId, date }).lean();
  }

  //deliberately always sets shopId explicitly (null default) - "not
  //provided" must never silently mean "every shop and the org-wide rollup
  //mixed together," which is never a meaningful result set for this list.
  async list(
    filter: DailyReportFilter,
  ): Promise<{ results: DailyReport[]; totalCount: number }> {
    const { page, pageSize } = toPaginationInfo(filter);
    const query = { shopId: filter?.shopId ?? null };

    const [results, totalCount] = await Promise.all([
      this.dailyReportRepository
        .find(query)
        .sort({ date: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      this.dailyReportRepository.countDocuments(query),
    ]);

    return { results, totalCount };
  }
}
