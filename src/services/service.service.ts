import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/dtos/common/api.response.dto';
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import { PagedResults } from 'src/dtos/common/paged.results.dto';
import { ServiceRequest } from 'src/dtos/service/service.request.dto';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { ServiceRepository } from 'src/repositories/service.repository';
import { Service } from 'src/schemas/service.schema';
import { toPaginationInfo } from 'src/utils';

@Injectable()
export class ServiceService {
  private readonly logger = new Logger(ServiceService.name);
  constructor(private readonly serviceRepository: ServiceRepository) {}

  async getById(id: string): Promise<ApiResponseDto<Service>> {
    try {
      const service = await this.serviceRepository.getById(id);
      if (!service) {
        return CommonResponses.NotFoundResponse<Service>('Service not found');
      }
      return CommonResponses.OkResponse<Service>(service);
    } catch (error) {
      this.logger.error(
        'an error occurred while getting service by id',
        id,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<Service>(
        'An error occurred while getting service by id',
      );
    }
  }

  async list(
    filter: BaseFilter,
  ): Promise<ApiResponseDto<PagedResults<Service>>> {
    try {
      const { page, pageSize } = toPaginationInfo(filter);
      const { results, totalCount } = await this.serviceRepository.list(filter);
      return CommonResponses.OkResponse<PagedResults<Service>>({
        results,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error(
        'an error occurred while listing services',
        filter,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<PagedResults<Service>>(
        'An error occurred while listing services',
      );
    }
  }

  async listActive(): Promise<ApiResponseDto<Service[]>> {
    try {
      const results = await this.serviceRepository.listActive();
      return CommonResponses.OkResponse<Service[]>(results);
    } catch (error) {
      this.logger.error(
        'an error occurred while listing active services',
        error,
      );
      return CommonResponses.InternalServerErrorResponse<Service[]>(
        'An error occurred while listing active services',
      );
    }
  }

  async create(request: ServiceRequest): Promise<ApiResponseDto<Service>> {
    try {
      const service = await this.serviceRepository.create(request);
      return CommonResponses.CreatedResponse<Service>(service);
    } catch (error) {
      this.logger.error(
        'an error occurred while creating service',
        request,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<Service>(
        'An error occurred while creating service',
      );
    }
  }

  async update(
    id: string,
    request: ServiceRequest,
  ): Promise<ApiResponseDto<Service>> {
    try {
      const service = await this.serviceRepository.update(id, request);
      if (!service) {
        return CommonResponses.NotFoundResponse<Service>('Service not found');
      }
      return CommonResponses.OkResponse<Service>(service);
    } catch (error) {
      this.logger.error(
        'an error occurred while updating service',
        { id, request },
        error,
      );
      return CommonResponses.InternalServerErrorResponse<Service>(
        'An error occurred while updating service',
      );
    }
  }

  async delete(id: string): Promise<ApiResponseDto<Service>> {
    try {
      const service = await this.serviceRepository.delete(id);
      if (!service) {
        return CommonResponses.NotFoundResponse<Service>('Service not found');
      }
      return CommonResponses.OkResponse<Service>(service);
    } catch (error) {
      this.logger.error('an error occurred while deleting service', id, error);
      return CommonResponses.InternalServerErrorResponse<Service>(
        'An error occurred while deleting service',
      );
    }
  }
}
