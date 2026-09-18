import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import { DropdownOption } from 'src/dtos/common/dropdown.option.dto';
import { ShopDropdownFilter } from 'src/dtos/shop/shop.dropdown.filter.dto';
import { ShopRequest } from 'src/dtos/shop/shop.request.dto';
import { Shop } from 'src/schemas/shop.schema';
import { generateId, toPaginationInfo } from 'src/utils';

@Injectable()
export class ShopRepository {
  constructor(
    @InjectModel(Shop.name) private readonly shopRepository: Model<Shop>,
  ) {}

  //get by id
  async getById(id: string): Promise<Shop> {
    return await this.shopRepository.findOne({ id }).lean();
  }

  //get by exact name - used by the seed script to link a user to a shop by name
  async getByName(name: string): Promise<Shop> {
    return await this.shopRepository.findOne({ name }).lean();
  }

  //list, with optional search over name/location
  async list(
    filter: BaseFilter,
  ): Promise<{ results: Shop[]; totalCount: number }> {
    const { page, pageSize } = toPaginationInfo(filter);
    const query: any = {};
    if (filter?.query) {
      const regex = new RegExp(filter.query, 'i');
      query.$or = [{ name: regex }, { location: regex }];
    }

    const [results, totalCount] = await Promise.all([
      this.shopRepository
        .find(query)
        .sort({ createdAt: -1, _id: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      this.shopRepository.countDocuments(query),
    ]);

    return { results, totalCount };
  }

  //lightweight {id, name} list for pickers - not paginated
  async listForDropdown(filter: ShopDropdownFilter): Promise<DropdownOption[]> {
    const query: any = {};
    if (filter?.query) {
      const regex = new RegExp(filter.query, 'i');
      query.$or = [{ name: regex }, { location: regex }];
    }
    if (filter?.status) {
      query.status = filter.status;
    }

    return await this.shopRepository
      .find(query, { id: 1, name: 1, _id: 0 })
      .sort({ name: 1 })
      .lean();
  }

  //create shop
  async create(request: ShopRequest): Promise<Shop> {
    const res = await this.shopRepository.create({
      ...request,
      operatingHours: withHourIds(request.operatingHours),
      id: generateId(),
    });
    return await this.shopRepository.findById(res._id).lean();
  }

  //update shop
  async update(id: string, request: ShopRequest): Promise<Shop> {
    const update: any = { ...request };
    if (request.operatingHours) {
      update.operatingHours = withHourIds(request.operatingHours);
    }
    return await this.shopRepository
      .findOneAndUpdate({ id }, { $set: update }, { new: true })
      .lean();
  }

  //delete shop
  async delete(id: string): Promise<Shop> {
    return await this.shopRepository.findOneAndDelete({ id }).lean();
  }
}

//backfill an id for any operating-hour row the caller didn't supply one for
function withHourIds(hours?: { id?: string }[]) {
  return hours?.map((hour) => ({ ...hour, id: hour.id || generateId() }));
}
