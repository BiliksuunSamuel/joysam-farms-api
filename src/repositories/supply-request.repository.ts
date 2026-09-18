import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SupplyRequestFilter } from 'src/dtos/supply-request/supply-request.filter.dto';
import { SupplyRequestStatus } from 'src/enums';
import { SupplierInfo } from 'src/models/supplier/supplier-info.model';
import { SupplyRequestItem } from 'src/models/supply-request/supply-request-item.model';
import { SupplyRequest } from 'src/schemas/supply-request.schema';
import { generateId, toPaginationInfo } from 'src/utils';

@Injectable()
export class SupplyRequestRepository {
  constructor(
    @InjectModel(SupplyRequest.name)
    private readonly supplyRequestRepository: Model<SupplyRequest>,
  ) {}

  //get by id
  async getById(id: string): Promise<SupplyRequest> {
    return await this.supplyRequestRepository.findOne({ id }).lean();
  }

  //list, optionally scoped by supplier, item or status
  async list(
    filter: SupplyRequestFilter,
  ): Promise<{ results: SupplyRequest[]; totalCount: number }> {
    const { page, pageSize } = toPaginationInfo(filter);
    const query: any = {};
    if (filter?.supplierId) query.supplierId = filter.supplierId;
    if (filter?.inventoryId) query['items.inventoryId'] = filter.inventoryId;
    if (filter?.status) query.status = filter.status;

    const [results, totalCount] = await Promise.all([
      this.supplyRequestRepository
        .find(query)
        .sort({ createdAt: -1, _id: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      this.supplyRequestRepository.countDocuments(query),
    ]);

    return { results, totalCount };
  }

  //raise a request (status Pending)
  async create(request: {
    supplierId: string;
    supplierInfoSnapshot: SupplierInfo;
    items: SupplyRequestItem[];
    notes?: string;
    requestedById: string;
  }): Promise<SupplyRequest> {
    const res = await this.supplyRequestRepository.create({
      ...request,
      id: generateId(),
    });
    return await this.supplyRequestRepository.findById(res._id).lean();
  }

  //approve a request - warehouse quantities are already updated by the caller
  async approve(
    id: string,
    reviewedById: string,
    notes?: string,
  ): Promise<SupplyRequest> {
    return await this.supplyRequestRepository
      .findOneAndUpdate(
        { id },
        {
          $set: {
            status: SupplyRequestStatus.Approved,
            reviewedById,
            ...(notes ? { notes } : {}),
          },
        },
        { new: true },
      )
      .lean();
  }

  //reject a request
  async reject(
    id: string,
    reviewedById: string,
    notes?: string,
  ): Promise<SupplyRequest> {
    return await this.supplyRequestRepository
      .findOneAndUpdate(
        { id },
        {
          $set: {
            status: SupplyRequestStatus.Rejected,
            reviewedById,
            ...(notes ? { notes } : {}),
          },
        },
        { new: true },
      )
      .lean();
  }
}
