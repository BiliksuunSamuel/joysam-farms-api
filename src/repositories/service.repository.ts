import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import { ServiceRequest } from 'src/dtos/service/service.request.dto';
import { ServiceStatus } from 'src/enums';
import { Service } from 'src/schemas/service.schema';
import { generateId, toPaginationInfo } from 'src/utils';

@Injectable()
export class ServiceRepository {
  constructor(
    @InjectModel(Service.name)
    private readonly serviceRepository: Model<Service>,
  ) {}

  //get by id
  async getById(id: string): Promise<Service> {
    return await this.serviceRepository.findOne({ id }).lean();
  }

  //list, with optional search over name
  async list(
    filter: BaseFilter,
  ): Promise<{ results: Service[]; totalCount: number }> {
    const { page, pageSize } = toPaginationInfo(filter);
    const query: any = {};
    if (filter?.query) {
      query.name = new RegExp(filter.query, 'i');
    }

    const [results, totalCount] = await Promise.all([
      this.serviceRepository
        .find(query)
        .sort({ createdAt: -1, _id: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      this.serviceRepository.countDocuments(query),
    ]);

    return { results, totalCount };
  }

  //every Active service, for checkout's service picker - not paginated,
  //same convention as a dropdown list, just not {id,name}-only since the
  //picker needs price/description too
  async listActive(): Promise<Service[]> {
    return await this.serviceRepository
      .find({ status: ServiceStatus.Active })
      .sort({ name: 1 })
      .lean();
  }

  async create(request: ServiceRequest): Promise<Service> {
    const res = await this.serviceRepository.create({
      ...request,
      id: generateId(),
    });
    return await this.serviceRepository.findById(res._id).lean();
  }

  async update(id: string, request: ServiceRequest): Promise<Service> {
    return await this.serviceRepository
      .findOneAndUpdate({ id }, { $set: request }, { new: true })
      .lean();
  }

  async delete(id: string): Promise<Service> {
    return await this.serviceRepository.findOneAndDelete({ id }).lean();
  }
}
