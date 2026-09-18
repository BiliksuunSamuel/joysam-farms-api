import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import { DropdownOption } from 'src/dtos/common/dropdown.option.dto';
import { RoleDropdownFilter } from 'src/dtos/role/role.dropdown.filter.dto';
import { RoleRequest } from 'src/dtos/role/role.request.dto';
import { Role } from 'src/schemas/role.schema';
import { generateId, toPaginationInfo } from 'src/utils';

@Injectable()
export class RoleRepository {
  constructor(
    @InjectModel(Role.name) private readonly roleRepository: Model<Role>,
  ) {}

  //get by id
  async getById(id: string): Promise<Role> {
    return await this.roleRepository.findOne({ id }).lean();
  }

  //get by name (roles are unique by name)
  async getByName(name: string): Promise<Role> {
    return await this.roleRepository.findOne({ name }).lean();
  }

  //list, with optional search over name
  async list(
    filter: BaseFilter,
  ): Promise<{ results: Role[]; totalCount: number }> {
    const { page, pageSize } = toPaginationInfo(filter);
    const query: any = {};
    if (filter?.query) {
      query.name = new RegExp(filter.query, 'i');
    }

    const [results, totalCount] = await Promise.all([
      this.roleRepository
        .find(query)
        .sort({ createdAt: -1, _id: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      this.roleRepository.countDocuments(query),
    ]);

    return { results, totalCount };
  }

  //lightweight {id, name} list for pickers - not paginated
  async listForDropdown(filter: RoleDropdownFilter): Promise<DropdownOption[]> {
    const query: any = {};
    if (filter?.query) {
      query.name = new RegExp(filter.query, 'i');
    }

    return await this.roleRepository
      .find(query, { id: 1, name: 1, _id: 0 })
      .sort({ name: 1 })
      .lean();
  }

  //create role
  async create(request: RoleRequest): Promise<Role> {
    const res = await this.roleRepository.create({
      ...request,
      id: generateId(),
    });
    return await this.roleRepository.findById(res._id).lean();
  }

  //update role
  async update(id: string, request: RoleRequest): Promise<Role> {
    return await this.roleRepository
      .findOneAndUpdate({ id }, { $set: request }, { new: true })
      .lean();
  }

  //delete role
  async delete(id: string): Promise<Role> {
    return await this.roleRepository.findOneAndDelete({ id }).lean();
  }
}
