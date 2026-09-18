import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/dtos/common/api.response.dto';
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import { DropdownOption } from 'src/dtos/common/dropdown.option.dto';
import { PagedResults } from 'src/dtos/common/paged.results.dto';
import { SupplierDropdownFilter } from 'src/dtos/supplier/supplier.dropdown.filter.dto';
import { SupplierRequest } from 'src/dtos/supplier/supplier.request.dto';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { SupplierRepository } from 'src/repositories/supplier.repository';
import { Supplier } from 'src/schemas/supplier.schema';
import { normalizePhone, toPaginationInfo } from 'src/utils';

@Injectable()
export class SupplierService {
  private readonly logger = new Logger(SupplierService.name);
  constructor(private readonly supplierRepository: SupplierRepository) {}

  async getById(id: string): Promise<ApiResponseDto<Supplier>> {
    try {
      const supplier = await this.supplierRepository.getById(id);
      if (!supplier) {
        return CommonResponses.NotFoundResponse<Supplier>('Supplier not found');
      }
      return CommonResponses.OkResponse<Supplier>(supplier);
    } catch (error) {
      this.logger.error(
        'an error occurred while getting supplier by id',
        id,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<Supplier>(
        'An error occurred while getting supplier by id',
      );
    }
  }

  async listForDropdown(
    filter: SupplierDropdownFilter,
  ): Promise<ApiResponseDto<DropdownOption[]>> {
    try {
      const results = await this.supplierRepository.listForDropdown(filter);
      return CommonResponses.OkResponse<DropdownOption[]>(results);
    } catch (error) {
      this.logger.error(
        'an error occurred while listing suppliers for dropdown',
        filter,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<DropdownOption[]>(
        'An error occurred while listing suppliers',
      );
    }
  }

  async list(filter: BaseFilter): Promise<ApiResponseDto<PagedResults<Supplier>>> {
    try {
      const { page, pageSize } = toPaginationInfo(filter);
      const { results, totalCount } = await this.supplierRepository.list(filter);
      return CommonResponses.OkResponse<PagedResults<Supplier>>({
        results,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error('an error occurred while listing suppliers', filter, error);
      return CommonResponses.InternalServerErrorResponse<PagedResults<Supplier>>(
        'An error occurred while listing suppliers',
      );
    }
  }

  async create(request: SupplierRequest): Promise<ApiResponseDto<Supplier>> {
    try {
      const supplier = await this.supplierRepository.create({
        ...request,
        phone: normalizePhone(request.phone),
      });
      return CommonResponses.CreatedResponse<Supplier>(supplier);
    } catch (error) {
      this.logger.error('an error occurred while creating supplier', request, error);
      return CommonResponses.InternalServerErrorResponse<Supplier>(
        'An error occurred while creating supplier',
      );
    }
  }

  async update(
    id: string,
    request: SupplierRequest,
  ): Promise<ApiResponseDto<Supplier>> {
    try {
      const supplier = await this.supplierRepository.update(id, {
        ...request,
        phone: normalizePhone(request.phone),
      });
      if (!supplier) {
        return CommonResponses.NotFoundResponse<Supplier>('Supplier not found');
      }
      return CommonResponses.OkResponse<Supplier>(supplier);
    } catch (error) {
      this.logger.error(
        'an error occurred while updating supplier',
        { id, request },
        error,
      );
      return CommonResponses.InternalServerErrorResponse<Supplier>(
        'An error occurred while updating supplier',
      );
    }
  }

  async delete(id: string): Promise<ApiResponseDto<Supplier>> {
    try {
      const existing = await this.supplierRepository.getById(id);
      if (!existing) {
        return CommonResponses.NotFoundResponse<Supplier>('Supplier not found');
      }
      const supplier = await this.supplierRepository.delete(id);
      if (!supplier) {
        return CommonResponses.NotFoundResponse<Supplier>('Supplier not found');
      }
      return CommonResponses.OkResponse<Supplier>(supplier);
    } catch (error) {
      this.logger.error('an error occurred while deleting supplier', id, error);
      return CommonResponses.InternalServerErrorResponse<Supplier>(
        'An error occurred while deleting supplier',
      );
    }
  }
}
