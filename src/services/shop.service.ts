import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/dtos/common/api.response.dto';
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import { DropdownOption } from 'src/dtos/common/dropdown.option.dto';
import { PagedResults } from 'src/dtos/common/paged.results.dto';
import { ShopDropdownFilter } from 'src/dtos/shop/shop.dropdown.filter.dto';
import { ShopRequest } from 'src/dtos/shop/shop.request.dto';
import { ShopResponse } from 'src/dtos/shop/shop.response.dto';
import { withOperatingTimeInfo } from 'src/extensions/shop.extensions';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { CounterRepository } from 'src/repositories/counter.repository';
import { ShopRepository } from 'src/repositories/shop.repository';
import { Shop } from 'src/schemas/shop.schema';
import { normalizePhone, toPaginationInfo } from 'src/utils';

@Injectable()
export class ShopService {
  private readonly logger = new Logger(ShopService.name);
  constructor(
    private readonly shopRepository: ShopRepository,
    private readonly counterRepository: CounterRepository,
  ) {}

  //attaches the receipt number the shop's *next* sale would get, without
  //incrementing anything - same prefix logic as SaleService.generateReceiptNo
  private async attachReceiptInfo(
    shop: Omit<ShopResponse, 'nextReceiptNo'>,
  ): Promise<ShopResponse> {
    const prefix =
      shop.receiptPrefix?.toUpperCase() ||
      shop.name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() ||
      'SHP';
    const seq = await this.counterRepository.peek(`sale:${shop.id}`);
    return { ...shop, nextReceiptNo: `${prefix}-${String(seq + 1).padStart(6, '0')}` };
  }

  //get by id
  async getById(id: string): Promise<ApiResponseDto<ShopResponse>> {
    try {
      const shop = await this.shopRepository.getById(id);
      if (!shop) {
        return CommonResponses.NotFoundResponse<ShopResponse>('Shop not found');
      }
      return CommonResponses.OkResponse<ShopResponse>(
        await this.attachReceiptInfo(withOperatingTimeInfo(shop)),
      );
    } catch (error) {
      this.logger.error(
        'an error occurred while getting shop by id',
        id,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<ShopResponse>(
        'An error occurred while getting shop by id',
      );
    }
  }

  async listForDropdown(
    filter: ShopDropdownFilter,
  ): Promise<ApiResponseDto<DropdownOption[]>> {
    try {
      const results = await this.shopRepository.listForDropdown(filter);
      return CommonResponses.OkResponse<DropdownOption[]>(results);
    } catch (error) {
      this.logger.error(
        'an error occurred while listing shops for dropdown',
        filter,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<DropdownOption[]>(
        'An error occurred while listing shops',
      );
    }
  }

  //list shops
  async list(
    filter: BaseFilter,
  ): Promise<ApiResponseDto<PagedResults<ShopResponse>>> {
    try {
      const { page, pageSize } = toPaginationInfo(filter);
      const { results, totalCount } = await this.shopRepository.list(filter);
      return CommonResponses.OkResponse<PagedResults<ShopResponse>>({
        results: await Promise.all(
          results.map(withOperatingTimeInfo).map((shop) => this.attachReceiptInfo(shop)),
        ),
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error('an error occurred while listing shops', filter, error);
      return CommonResponses.InternalServerErrorResponse<
        PagedResults<ShopResponse>
      >('An error occurred while listing shops');
    }
  }

  //create shop
  async create(request: ShopRequest): Promise<ApiResponseDto<ShopResponse>> {
    try {
      const shop = await this.shopRepository.create({
        ...request,
        phone: normalizePhone(request.phone),
      });
      return CommonResponses.CreatedResponse<ShopResponse>(
        await this.attachReceiptInfo(withOperatingTimeInfo(shop)),
      );
    } catch (error) {
      this.logger.error(
        'an error occurred while creating shop',
        request,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<ShopResponse>(
        'An error occurred while creating shop',
      );
    }
  }

  //update shop
  async update(
    id: string,
    request: ShopRequest,
  ): Promise<ApiResponseDto<ShopResponse>> {
    try {
      const shop = await this.shopRepository.update(id, {
        ...request,
        phone: normalizePhone(request.phone),
      });
      if (!shop) {
        return CommonResponses.NotFoundResponse<ShopResponse>('Shop not found');
      }
      return CommonResponses.OkResponse<ShopResponse>(
        await this.attachReceiptInfo(withOperatingTimeInfo(shop)),
      );
    } catch (error) {
      this.logger.error(
        'an error occurred while updating shop',
        { id, request },
        error,
      );
      return CommonResponses.InternalServerErrorResponse<ShopResponse>(
        'An error occurred while updating shop',
      );
    }
  }

  //delete shop
  async delete(id: string): Promise<ApiResponseDto<Shop>> {
    try {
      const shop = await this.shopRepository.delete(id);
      if (!shop) {
        return CommonResponses.NotFoundResponse<Shop>('Shop not found');
      }
      return CommonResponses.OkResponse<Shop>(shop);
    } catch (error) {
      this.logger.error('an error occurred while deleting shop', id, error);
      return CommonResponses.InternalServerErrorResponse<Shop>(
        'An error occurred while deleting shop',
      );
    }
  }
}
