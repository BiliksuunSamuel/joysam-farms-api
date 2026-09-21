import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/dtos/common/api.response.dto';
import { PagedResults } from 'src/dtos/common/paged.results.dto';
import { CustomerFilter } from 'src/dtos/customer/customer.filter.dto';
import { CustomerRequest } from 'src/dtos/customer/customer.request.dto';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { CustomerRepository } from 'src/repositories/customer.repository';
import { Customer } from 'src/schemas/customer.schema';
import { toPaginationInfo } from 'src/utils';

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);
  constructor(private readonly customerRepository: CustomerRepository) {}

  //get by id
  async getById(id: string): Promise<ApiResponseDto<Customer>> {
    try {
      const customer = await this.customerRepository.getById(id);
      if (!customer) {
        return CommonResponses.NotFoundResponse<Customer>('Customer not found');
      }
      return CommonResponses.OkResponse<Customer>(customer);
    } catch (error) {
      this.logger.error(
        'an error occurred while getting customer by id',
        id,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<Customer>(
        'An error occurred while getting customer by id',
      );
    }
  }

  //list, with search over name/phone
  async list(
    filter: CustomerFilter,
  ): Promise<ApiResponseDto<PagedResults<Customer>>> {
    try {
      const { page, pageSize } = toPaginationInfo(filter);
      const { results, totalCount } =
        await this.customerRepository.list(filter);
      return CommonResponses.OkResponse<PagedResults<Customer>>({
        results,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error(
        'an error occurred while listing customers',
        filter,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<
        PagedResults<Customer>
      >('An error occurred while listing customers');
    }
  }

  //register a customer
  async create(request: CustomerRequest): Promise<ApiResponseDto<Customer>> {
    try {
      const existing = await this.customerRepository.getByPhone(request.phone);
      if (existing) {
        return CommonResponses.ConflictResponse<Customer>(
          'A customer with this phone number already exists',
        );
      }
      const customer = await this.customerRepository.create(request);
      return CommonResponses.CreatedResponse<Customer>(customer);
    } catch (error) {
      this.logger.error(
        'an error occurred while registering customer',
        request,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<Customer>(
        'An error occurred while registering customer',
      );
    }
  }

  //update profile fields
  async update(
    id: string,
    request: CustomerRequest,
  ): Promise<ApiResponseDto<Customer>> {
    try {
      const conflict = await this.customerRepository.getByPhone(request.phone);
      if (conflict && conflict.id !== id) {
        return CommonResponses.ConflictResponse<Customer>(
          'Another customer already uses this phone number',
        );
      }
      const customer = await this.customerRepository.update(id, request);
      if (!customer) {
        return CommonResponses.NotFoundResponse<Customer>('Customer not found');
      }
      return CommonResponses.OkResponse<Customer>(customer);
    } catch (error) {
      this.logger.error(
        'an error occurred while updating customer',
        { id, request },
        error,
      );
      return CommonResponses.InternalServerErrorResponse<Customer>(
        'An error occurred while updating customer',
      );
    }
  }

  // Internal API for SaleService: record a customer's details at checkout,
  // reusing the existing account for this phone number if there is one -
  // see CustomerRepository.findOrCreateByPhone. Lean, not
  // HTTP-response-shaped, the same convention as VendorService's internal
  // methods.
  async findOrCreateForSale(request: {
    name: string;
    phone: string;
  }): Promise<Customer> {
    return await this.customerRepository.findOrCreateByPhone(request);
  }
}
