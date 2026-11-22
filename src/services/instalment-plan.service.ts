import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/dtos/common/api.response.dto';
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import { PagedResults } from 'src/dtos/common/paged.results.dto';
import { InstalmentPlanRequest } from 'src/dtos/instalment/instalment-plan.request.dto';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { InstalmentPlanRepository } from 'src/repositories/instalment-plan.repository';
import { InstalmentPlan } from 'src/schemas/instalment-plan.schema';
import { toPaginationInfo } from 'src/utils';

@Injectable()
export class InstalmentPlanService {
  private readonly logger = new Logger(InstalmentPlanService.name);
  constructor(private readonly planRepository: InstalmentPlanRepository) {}

  async list(
    filter: BaseFilter,
  ): Promise<ApiResponseDto<PagedResults<InstalmentPlan>>> {
    try {
      const { page, pageSize } = toPaginationInfo(filter);
      const { results, totalCount } = await this.planRepository.list(filter);
      return CommonResponses.OkResponse<PagedResults<InstalmentPlan>>({
        results,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error('an error occurred while listing plans', filter, error);
      return CommonResponses.InternalServerErrorResponse<
        PagedResults<InstalmentPlan>
      >('An error occurred while listing instalment plans');
    }
  }

  async listActive(): Promise<ApiResponseDto<InstalmentPlan[]>> {
    try {
      return CommonResponses.OkResponse<InstalmentPlan[]>(
        await this.planRepository.listActive(),
      );
    } catch (error) {
      this.logger.error('an error occurred while listing active plans', error);
      return CommonResponses.InternalServerErrorResponse<InstalmentPlan[]>(
        'An error occurred while listing instalment plans',
      );
    }
  }

  async create(
    request: InstalmentPlanRequest,
  ): Promise<ApiResponseDto<InstalmentPlan>> {
    try {
      return CommonResponses.CreatedResponse<InstalmentPlan>(
        await this.planRepository.create(request),
      );
    } catch (error) {
      this.logger.error('an error occurred while creating a plan', request, error);
      return CommonResponses.InternalServerErrorResponse<InstalmentPlan>(
        'An error occurred while creating the instalment plan',
      );
    }
  }

  async update(
    id: string,
    request: InstalmentPlanRequest,
  ): Promise<ApiResponseDto<InstalmentPlan>> {
    try {
      const plan = await this.planRepository.update(id, request);
      if (!plan) {
        return CommonResponses.NotFoundResponse<InstalmentPlan>('Plan not found');
      }
      return CommonResponses.OkResponse<InstalmentPlan>(plan);
    } catch (error) {
      this.logger.error('an error occurred while updating a plan', { id, request }, error);
      return CommonResponses.InternalServerErrorResponse<InstalmentPlan>(
        'An error occurred while updating the instalment plan',
      );
    }
  }

  // Sales already on the plan keep their own copy of its terms, so removing
  // a plan is safe.
  async delete(id: string): Promise<ApiResponseDto<InstalmentPlan>> {
    try {
      const plan = await this.planRepository.delete(id);
      if (!plan) {
        return CommonResponses.NotFoundResponse<InstalmentPlan>('Plan not found');
      }
      return CommonResponses.OkResponse<InstalmentPlan>(plan);
    } catch (error) {
      this.logger.error('an error occurred while deleting a plan', id, error);
      return CommonResponses.InternalServerErrorResponse<InstalmentPlan>(
        'An error occurred while deleting the instalment plan',
      );
    }
  }
}
