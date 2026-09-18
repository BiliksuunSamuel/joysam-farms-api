import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/dtos/common/api.response.dto';
import { PagedResults } from 'src/dtos/common/paged.results.dto';
import { AuditLogFilter } from 'src/dtos/audit-log/audit-log.filter.dto';
import { AuditLogResponse } from 'src/dtos/audit-log/audit-log.response.dto';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { AuditLogRepository } from 'src/repositories/audit-log.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { AuditLog } from 'src/schemas/audit-log.schema';
import { toPaginationInfo } from 'src/utils';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);
  constructor(
    private readonly auditLogRepository: AuditLogRepository,
    private readonly userRepository: UserRepository,
  ) {}

  //resolves each entry's performedById to a display name in one batch,
  //rather than one lookup per row
  private async withPerformerNames(
    entries: AuditLog[],
  ): Promise<AuditLogResponse[]> {
    const cache = new Map<string, string | null>();
    const results: AuditLogResponse[] = [];
    for (const entry of entries) {
      let name: string | null | undefined = entry.performedById
        ? cache.get(entry.performedById)
        : null;
      if (name === undefined) {
        const user = await this.userRepository.getById(entry.performedById);
        name = user?.name ?? null;
        cache.set(entry.performedById, name);
      }
      results.push({ ...entry, performedByName: name });
    }
    return results;
  }

  //get by id
  async getById(id: string): Promise<ApiResponseDto<AuditLogResponse>> {
    try {
      const entry = await this.auditLogRepository.getById(id);
      if (!entry) {
        return CommonResponses.NotFoundResponse<AuditLogResponse>(
          'Audit log entry not found',
        );
      }
      const [withName] = await this.withPerformerNames([entry]);
      return CommonResponses.OkResponse<AuditLogResponse>(withName);
    } catch (error) {
      this.logger.error(
        'an error occurred while getting audit log entry by id',
        id,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<AuditLogResponse>(
        'An error occurred while getting audit log entry by id',
      );
    }
  }

  //list, optionally scoped by entity, action, who performed it, a date
  //range, or a free-text search
  async list(
    filter: AuditLogFilter,
  ): Promise<ApiResponseDto<PagedResults<AuditLogResponse>>> {
    try {
      const { page, pageSize } = toPaginationInfo(filter);
      const { results, totalCount } =
        await this.auditLogRepository.list(filter);
      return CommonResponses.OkResponse<PagedResults<AuditLogResponse>>({
        results: await this.withPerformerNames(results),
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error(
        'an error occurred while listing audit log entries',
        filter,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<
        PagedResults<AuditLogResponse>
      >('An error occurred while listing audit log entries');
    }
  }

  /**
   * Record an action. Used internally (by the AuditLogInterceptor, and any
   * feature that wants to log something the interceptor can't see) - never
   * throws, since a failure to log an action must never break the action
   * itself.
   */
  async record(entry: {
    entityType: string;
    entityId?: string;
    action: string;
    description: string;
    performedById?: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
    agent?: string;
  }): Promise<void> {
    try {
      await this.auditLogRepository.create(entry);
    } catch (error) {
      this.logger.error('failed to record audit log entry', entry, error);
    }
  }
}
