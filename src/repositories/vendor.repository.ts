import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VendorFilter } from 'src/dtos/vendor/vendor.filter.dto';
import { VendorRequest } from 'src/dtos/vendor/vendor.request.dto';
import { Vendor } from 'src/schemas/vendor.schema';
import { generateId, toPaginationInfo } from 'src/utils';

@Injectable()
export class VendorRepository {
  constructor(
    @InjectModel(Vendor.name)
    private readonly vendorRepository: Model<Vendor>,
  ) {}

  //get by id
  async getById(id: string): Promise<Vendor> {
    return await this.vendorRepository.findOne({ id }).lean();
  }

  //list, optionally scoped by status, with search over name/contactName
  async list(
    filter: VendorFilter,
  ): Promise<{ results: Vendor[]; totalCount: number }> {
    const { page, pageSize } = toPaginationInfo(filter);
    const query: any = {};
    if (filter?.status) query.status = filter.status;
    if (filter?.query) {
      const regex = new RegExp(filter.query, 'i');
      query.$or = [{ name: regex }, { contactName: regex }];
    }

    const [results, totalCount] = await Promise.all([
      this.vendorRepository
        .find(query)
        .sort({ name: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      this.vendorRepository.countDocuments(query),
    ]);

    return { results, totalCount };
  }

  //register a vendor
  async create(request: VendorRequest): Promise<Vendor> {
    const res = await this.vendorRepository.create({
      ...request,
      id: generateId(),
    });
    return await this.vendorRepository.findById(res._id).lean();
  }

  //update profile fields
  async update(id: string, request: VendorRequest): Promise<Vendor> {
    return await this.vendorRepository
      .findOneAndUpdate({ id }, { $set: request }, { new: true })
      .lean();
  }
}
