import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CustomerFilter } from 'src/dtos/customer/customer.filter.dto';
import { Customer } from 'src/schemas/customer.schema';
import { generateId, normalizePhone, toPaginationInfo } from 'src/utils';

@Injectable()
export class CustomerRepository {
  constructor(
    @InjectModel(Customer.name)
    private readonly customerRepository: Model<Customer>,
  ) {}

  //get by id
  async getById(id: string): Promise<Customer> {
    return await this.customerRepository.findOne({ id }).lean();
  }

  //get by phone - phone is stored normalized, so the lookup value must be too
  async getByPhone(phone: string): Promise<Customer> {
    return await this.customerRepository
      .findOne({ phone: normalizePhone(phone) })
      .lean();
  }

  //list, with search over name/phone
  async list(
    filter: CustomerFilter,
  ): Promise<{ results: Customer[]; totalCount: number }> {
    const { page, pageSize } = toPaginationInfo(filter);
    const query: any = {};
    if (filter?.query) {
      const regex = new RegExp(filter.query, 'i');
      query.$or = [{ name: regex }, { phone: regex }];
    }

    const [results, totalCount] = await Promise.all([
      this.customerRepository
        .find(query)
        .sort({ name: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      this.customerRepository.countDocuments(query),
    ]);

    return { results, totalCount };
  }

  //register a customer
  async create(request: { name: string; phone: string }): Promise<Customer> {
    const res = await this.customerRepository.create({
      name: request.name,
      phone: normalizePhone(request.phone),
      id: generateId(),
    });
    return await this.customerRepository.findById(res._id).lean();
  }

  //update profile fields
  async update(
    id: string,
    request: { name?: string; phone?: string },
  ): Promise<Customer> {
    return await this.customerRepository
      .findOneAndUpdate(
        { id },
        {
          $set: {
            ...request,
            phone: request.phone ? normalizePhone(request.phone) : undefined,
          },
        },
        { new: true },
      )
      .lean();
  }

  // The core "record customer details at checkout" behaviour: reuse the
  // existing customer for this phone number if there is one (correcting
  // their name if it's changed since), otherwise register a new one. Phone
  // is the identity here, not name - two different people typed under the
  // same number would incorrectly merge, but there's no better signal to
  // dedupe walk-in customers by at a till.
  async findOrCreateByPhone(request: {
    name: string;
    phone: string;
  }): Promise<Customer> {
    const phone = normalizePhone(request.phone);
    const existing = await this.customerRepository.findOne({ phone });
    if (existing) {
      if (request.name && request.name !== existing.name) {
        existing.name = request.name;
        await existing.save();
      }
      return existing.toObject();
    }
    return await this.create({ name: request.name, phone });
  }
}
