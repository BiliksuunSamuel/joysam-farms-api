import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import { DropdownOption } from 'src/dtos/common/dropdown.option.dto';
import { SupplierDropdownFilter } from 'src/dtos/supplier/supplier.dropdown.filter.dto';
import { SupplierRequest } from 'src/dtos/supplier/supplier.request.dto';
import { Supplier } from 'src/schemas/supplier.schema';
import { generateId, toPaginationInfo } from 'src/utils';

@Injectable()
export class SupplierRepository {
  constructor(
    @InjectModel(Supplier.name)
    private readonly supplierRepository: Model<Supplier>,
  ) {}

  //get by id
  async getById(id: string): Promise<Supplier> {
    return await this.supplierRepository.findOne({ id }).lean();
  }

  //list, with optional search over name/contact/phone
  async list(
    filter: BaseFilter,
  ): Promise<{ results: Supplier[]; totalCount: number }> {
    const { page, pageSize } = toPaginationInfo(filter);
    const query: any = {};
    if (filter?.query) {
      const regex = new RegExp(filter.query, 'i');
      query.$or = [{ name: regex }, { contactName: regex }, { phone: regex }];
    }

    const [results, totalCount] = await Promise.all([
      this.supplierRepository
        .find(query)
        .sort({ createdAt: -1, _id: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      this.supplierRepository.countDocuments(query),
    ]);

    return { results, totalCount };
  }

  //lightweight {id, name} list for pickers - not paginated
  async listForDropdown(
    filter: SupplierDropdownFilter,
  ): Promise<DropdownOption[]> {
    const query: any = {};
    if (filter?.query) {
      query.name = new RegExp(filter.query, 'i');
    }

    return await this.supplierRepository
      .find(query, { id: 1, name: 1, _id: 0 })
      .sort({ name: 1 })
      .lean();
  }

  //create supplier
  async create(request: SupplierRequest): Promise<Supplier> {
    const res = await this.supplierRepository.create({
      ...request,
      id: generateId(),
    });
    return await this.supplierRepository.findById(res._id).lean();
  }

  //update supplier
  async update(id: string, request: SupplierRequest): Promise<Supplier> {
    return await this.supplierRepository
      .findOneAndUpdate({ id }, { $set: request }, { new: true })
      .lean();
  }

  //delete supplier
  async delete(id: string): Promise<Supplier> {
    return await this.supplierRepository.findOneAndDelete({ id }).lean();
  }
}
