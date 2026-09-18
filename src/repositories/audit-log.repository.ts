import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLogFilter } from 'src/dtos/audit-log/audit-log.filter.dto';
import { AuditLog } from 'src/schemas/audit-log.schema';
import { generateId, toPaginationInfo } from 'src/utils';

@Injectable()
export class AuditLogRepository {
  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogRepository: Model<AuditLog>,
  ) {}

  //get by id
  async getById(id: string): Promise<AuditLog> {
    return await this.auditLogRepository.findOne({ id }).lean();
  }

  //list, optionally scoped by entity, action, who performed it, a date
  //range, or a free-text search over the description
  async list(
    filter: AuditLogFilter,
  ): Promise<{ results: AuditLog[]; totalCount: number }> {
    const { page, pageSize } = toPaginationInfo(filter);
    const query: any = {};
    if (filter?.entityType) query.entityType = filter.entityType;
    if (filter?.entityId) query.entityId = filter.entityId;
    if (filter?.action) query.action = filter.action;
    if (filter?.performedById) query.performedById = filter.performedById;
    if (filter?.startDate || filter?.endDate) {
      query.createdAt = {};
      if (filter.startDate) query.createdAt.$gte = new Date(filter.startDate);
      if (filter.endDate) query.createdAt.$lte = new Date(filter.endDate);
    }
    if (filter?.query) {
      query.description = new RegExp(filter.query, 'i');
    }

    const [results, totalCount] = await Promise.all([
      this.auditLogRepository
        .find(query)
        .sort({ createdAt: -1, _id: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      this.auditLogRepository.countDocuments(query),
    ]);

    return { results, totalCount };
  }

  //append an entry - audit logs are never updated or deleted
  async create(entry: {
    entityType: string;
    entityId?: string;
    action: string;
    description: string;
    performedById?: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
    agent?: string;
  }): Promise<AuditLog> {
    const res = await this.auditLogRepository.create({
      ...entry,
      id: generateId(),
    });
    return await this.auditLogRepository.findById(res._id).lean();
  }
}
