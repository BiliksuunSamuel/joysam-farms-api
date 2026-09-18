import { Injectable, Logger } from '@nestjs/common';
import { CategoryDropdownFilter } from 'src/dtos/category/category.dropdown.filter.dto';
import { CategoryRequest } from 'src/dtos/category/category.request.dto';
import { ApiResponseDto } from 'src/dtos/common/api.response.dto';
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import { DropdownOption } from 'src/dtos/common/dropdown.option.dto';
import { PagedResults } from 'src/dtos/common/paged.results.dto';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { CategoryRepository } from 'src/repositories/category.repository';
import { InventoryRepository } from 'src/repositories/inventory.repository';
import { Category } from 'src/schemas/category.schema';
import { toPaginationInfo } from 'src/utils';

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);
  constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly inventoryRepository: InventoryRepository,
  ) {}

  //get by id
  async getById(id: string): Promise<ApiResponseDto<Category>> {
    try {
      const category = await this.categoryRepository.getById(id);
      if (!category) {
        return CommonResponses.NotFoundResponse<Category>('Category not found');
      }
      return CommonResponses.OkResponse<Category>(category);
    } catch (error) {
      this.logger.error(
        'an error occurred while getting category by id',
        id,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<Category>(
        'An error occurred while getting category by id',
      );
    }
  }

  async listForDropdown(
    filter: CategoryDropdownFilter,
  ): Promise<ApiResponseDto<DropdownOption[]>> {
    try {
      const results = await this.categoryRepository.listForDropdown(filter);
      return CommonResponses.OkResponse<DropdownOption[]>(results);
    } catch (error) {
      this.logger.error(
        'an error occurred while listing categories for dropdown',
        filter,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<DropdownOption[]>(
        'An error occurred while listing categories',
      );
    }
  }

  //list categories
  async list(
    filter: BaseFilter,
  ): Promise<ApiResponseDto<PagedResults<Category>>> {
    try {
      const { page, pageSize } = toPaginationInfo(filter);
      const { results, totalCount } =
        await this.categoryRepository.list(filter);
      return CommonResponses.OkResponse<PagedResults<Category>>({
        results,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error(
        'an error occurred while listing categories',
        filter,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<
        PagedResults<Category>
      >('An error occurred while listing categories');
    }
  }

  //create category
  async create(request: CategoryRequest): Promise<ApiResponseDto<Category>> {
    try {
      const category = await this.categoryRepository.create(request);
      return CommonResponses.CreatedResponse<Category>(category);
    } catch (error) {
      this.logger.error(
        'an error occurred while creating category',
        request,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<Category>(
        'An error occurred while creating category',
      );
    }
  }

  //update category
  async update(
    id: string,
    request: CategoryRequest,
  ): Promise<ApiResponseDto<Category>> {
    try {
      const category = await this.categoryRepository.update(id, request);
      if (!category) {
        return CommonResponses.NotFoundResponse<Category>('Category not found');
      }
      return CommonResponses.OkResponse<Category>(category);
    } catch (error) {
      this.logger.error(
        'an error occurred while updating category',
        { id, request },
        error,
      );
      return CommonResponses.InternalServerErrorResponse<Category>(
        'An error occurred while updating category',
      );
    }
  }

  //delete category
  async delete(id: string): Promise<ApiResponseDto<Category>> {
    try {
      const existing = await this.categoryRepository.getById(id);
      if (!existing) {
        return CommonResponses.NotFoundResponse<Category>('Category not found');
      }

      const inUse = await this.inventoryRepository.existsByCategoryId(id);
      if (inUse) {
        return CommonResponses.BadRequestResponse<Category>(
          undefined,
          'Move its inventory items to another category before deleting it',
        );
      }

      const category = await this.categoryRepository.delete(id);
      if (!category) {
        return CommonResponses.NotFoundResponse<Category>('Category not found');
      }
      return CommonResponses.OkResponse<Category>(category);
    } catch (error) {
      this.logger.error('an error occurred while deleting category', id, error);
      return CommonResponses.InternalServerErrorResponse<Category>(
        'An error occurred while deleting category',
      );
    }
  }
}
