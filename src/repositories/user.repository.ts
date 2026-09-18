import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DropdownOption } from 'src/dtos/common/dropdown.option.dto';
import { UserDropdownFilter } from 'src/dtos/user/user.dropdown.filter.dto';
import { UserFilter } from 'src/dtos/user/user.filter.dto';
import { UserRequest } from 'src/dtos/user/user.request.dto';
import { UserStatus } from 'src/enums';
import { ShopInfo } from 'src/models/shop/shop-info.model';
import { User } from 'src/schemas/user.schema';
import { generateId, toPaginationInfo } from 'src/utils';

@Injectable()
export class UserRepository {
  constructor(
    @InjectModel(User.name) private readonly userRepository: Model<User>,
  ) {}

  //get by id
  async getById(id: string): Promise<User> {
    return await this.userRepository.findOne({ id }).lean();
  }

  //get by email
  async getByEmail(email: string): Promise<User> {
    return await this.userRepository.findOne({ email }).lean();
  }

  //list, with optional search over name/email/phone and role/shop/status
  //filters. excludeId lets a caller leave themselves out of their own list
  //(e.g. the signed-in user managing other employees).
  async list(
    filter: UserFilter,
    excludeId?: string,
  ): Promise<{ results: User[]; totalCount: number }> {
    const { page, pageSize } = toPaginationInfo(filter);
    const query: any = {};
    if (excludeId) {
      query.id = { $ne: excludeId };
    }
    if (filter?.query) {
      const regex = new RegExp(filter.query, 'i');
      query.$or = [{ name: regex }, { email: regex }, { phone: regex }];
    }
    if (filter?.roleId) {
      query.roleId = filter.roleId;
    }
    if (filter?.shopId) {
      query.shopId = filter.shopId;
    }
    if (filter?.status) {
      query.status = filter.status;
    }

    const [results, totalCount] = await Promise.all([
      this.userRepository
        .find(query)
        .sort({ createdAt: -1, _id: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      this.userRepository.countDocuments(query),
    ]);

    return { results, totalCount };
  }

  //lightweight {id, name} list for pickers - not paginated
  async listForDropdown(
    filter: UserDropdownFilter,
    excludeId?: string,
  ): Promise<DropdownOption[]> {
    const query: any = {};
    if (excludeId) {
      query.id = { $ne: excludeId };
    }
    if (filter?.query) {
      const regex = new RegExp(filter.query, 'i');
      query.$or = [{ name: regex }, { email: regex }, { phone: regex }];
    }
    if (filter?.roleId) {
      query.roleId = filter.roleId;
    }
    if (filter?.shopId) {
      query.shopId = filter.shopId;
    }
    if (filter?.status) {
      query.status = filter.status;
    }

    return await this.userRepository
      .find(query, { id: 1, name: 1, _id: 0 })
      .sort({ name: 1 })
      .lean();
  }

  //create user
  async create(
    request: UserRequest & {
      shopInfoSnapshot?: ShopInfo;
      allPermissions?: boolean;
    },
  ): Promise<User> {
    const res = await this.userRepository.create({
      ...request,
      id: generateId(),
    });
    return await this.userRepository.findById(res._id).lean();
  }

  //update user
  async update(
    id: string,
    request: UserRequest & { shopInfoSnapshot?: ShopInfo | null },
  ): Promise<User> {
    const res = await this.userRepository
      .findOneAndUpdate({ id }, { $set: request }, { new: true })
      .lean();
    return res;
  }

  //update status (enable/disable)
  async updateStatus(id: string, status: UserStatus): Promise<User> {
    return await this.userRepository
      .findOneAndUpdate({ id }, { $set: { status } }, { new: true })
      .lean();
  }

  //update permissions directly (independent of role)
  async updatePermissions(
    id: string,
    request: { permissionKeys?: string[]; allPermissions?: boolean },
  ): Promise<User> {
    return await this.userRepository
      .findOneAndUpdate({ id }, { $set: request }, { new: true })
      .lean();
  }

  //delete user
  async delete(id: string): Promise<User> {
    return await this.userRepository.findOneAndDelete({ id }).lean();
  }

  //whether any user is currently assigned this role (used to block deleting it)
  async existsByRoleId(roleId: string): Promise<boolean> {
    return await this.userRepository.exists({ roleId }).then(Boolean);
  }

  //total user count (used to detect a fresh install with no users yet)
  async count(): Promise<number> {
    return await this.userRepository.countDocuments();
  }

  //count of active users with full access (used to guard against removing
  //the platform's last full-access employee)
  async countActiveWithAllPermissions(): Promise<number> {
    return await this.userRepository.countDocuments({
      allPermissions: true,
      status: UserStatus.Active,
    });
  }
}
