import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import { InstalmentPlanRequest } from 'src/dtos/instalment/instalment-plan.request.dto';
import { InstalmentPlan } from 'src/schemas/instalment-plan.schema';
import { generateId, toPaginationInfo } from 'src/utils';

@Injectable()
export class InstalmentPlanRepository {
  constructor(
    @InjectModel(InstalmentPlan.name)
    private readonly planRepository: Model<InstalmentPlan>,
  ) {}

  async getById(id: string): Promise<InstalmentPlan> {
    return await this.planRepository.findOne({ id }).lean();
  }

  async list(
    filter: BaseFilter,
  ): Promise<{ results: InstalmentPlan[]; totalCount: number }> {
    const { page, pageSize } = toPaginationInfo(filter);
    const query: any = {};
    if (filter?.query) query.name = new RegExp(filter.query, 'i');
    const [results, totalCount] = await Promise.all([
      this.planRepository
        .find(query)
        .sort({ createdAt: -1, _id: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      this.planRepository.countDocuments(query),
    ]);
    return { results, totalCount };
  }

  // For checkout's plan picker - not paginated.
  async listActive(): Promise<InstalmentPlan[]> {
    return await this.planRepository.find({ active: true }).sort({ name: 1 }).lean();
  }

  async create(request: InstalmentPlanRequest): Promise<InstalmentPlan> {
    const res = await this.planRepository.create({
      ...request,
      id: generateId(),
    });
    return await this.planRepository.findById(res._id).lean();
  }

  async update(
    id: string,
    request: InstalmentPlanRequest,
  ): Promise<InstalmentPlan> {
    return await this.planRepository
      .findOneAndUpdate({ id }, { $set: request }, { new: true })
      .lean();
  }

  async delete(id: string): Promise<InstalmentPlan> {
    return await this.planRepository.findOneAndDelete({ id }).lean();
  }
}
