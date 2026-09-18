import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import { CategoryDropdownFilter } from 'src/dtos/category/category.dropdown.filter.dto';
import { CategoryRequest } from 'src/dtos/category/category.request.dto';
import { DropdownOption } from 'src/dtos/common/dropdown.option.dto';
import { Category } from 'src/schemas/category.schema';
import { generateId, generateNumericCode, toPaginationInfo } from 'src/utils';

const CATEGORY_CODE_LENGTH = 8;

@Injectable()
export class CategoryRepository {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryRepository: Model<Category>,
  ) {}

  //get by id
  async getById(id: string): Promise<Category> {
    return await this.categoryRepository.findOne({ id }).lean();
  }

  //batch get by id - avoids an N+1 lookup when attaching category info to
  //a page of another resource's results (e.g. inventory items)
  async getByIds(ids: string[]): Promise<Category[]> {
    return await this.categoryRepository.find({ id: { $in: ids } }).lean();
  }

  //get by name, case-insensitive exact match - used to resolve a
  //human-typed category name (e.g. from a bulk-import spreadsheet) to a
  //categoryId
  async getByName(name: string): Promise<Category> {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return await this.categoryRepository
      .findOne({ name: new RegExp(`^${escaped}$`, 'i') })
      .lean();
  }

  //list, with optional search over name
  async list(
    filter: BaseFilter,
  ): Promise<{ results: Category[]; totalCount: number }> {
    const { page, pageSize } = toPaginationInfo(filter);
    const query: any = {};
    if (filter?.query) {
      query.name = new RegExp(filter.query, 'i');
    }

    const [results, totalCount] = await Promise.all([
      this.categoryRepository
        .find(query)
        .sort({ createdAt: -1, _id: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      this.categoryRepository.countDocuments(query),
    ]);

    return { results, totalCount };
  }

  //lightweight {id, name} list for pickers - not paginated
  async listForDropdown(
    filter: CategoryDropdownFilter,
  ): Promise<DropdownOption[]> {
    const query: any = {};
    if (filter?.query) {
      query.name = new RegExp(filter.query, 'i');
    }

    return await this.categoryRepository
      .find(query, { id: 1, name: 1, _id: 0 })
      .sort({ name: 1 })
      .lean();
  }

  //create category, with a freshly generated, unique categoryCode
  async create(request: CategoryRequest): Promise<Category> {
    const categoryCode = await this.generateUniqueCategoryCode();
    const res = await this.categoryRepository.create({
      ...request,
      categoryCode,
      id: generateId(),
    });
    return await this.categoryRepository.findById(res._id).lean();
  }

  //update category (categoryCode is never changed once assigned)
  async update(id: string, request: CategoryRequest): Promise<Category> {
    return await this.categoryRepository
      .findOneAndUpdate({ id }, { $set: request }, { new: true })
      .lean();
  }

  //delete category
  async delete(id: string): Promise<Category> {
    return await this.categoryRepository.findOneAndDelete({ id }).lean();
  }

  private async generateUniqueCategoryCode(): Promise<string> {
    let categoryCode = generateNumericCode(CATEGORY_CODE_LENGTH);
    while (await this.categoryRepository.exists({ categoryCode })) {
      categoryCode = generateNumericCode(CATEGORY_CODE_LENGTH);
    }
    return categoryCode;
  }
}
