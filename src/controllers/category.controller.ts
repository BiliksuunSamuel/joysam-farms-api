import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CategoryDropdownFilter } from 'src/dtos/category/category.dropdown.filter.dto';
import { CategoryRequest } from 'src/dtos/category/category.request.dto';
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import { AuditLog } from 'src/decorators/audit-log.decorator';
import { AuthPermissions } from 'src/middlewares/auth.permissions';
import { AuditLogInterceptor } from 'src/providers/audit-log.interceptor';
import { CategoryService } from 'src/services/category.service';

@Controller('api/categories')
@ApiTags('Categories')
@UseInterceptors(AuditLogInterceptor)
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @AuthPermissions('inventory.category.view')
  async list(@Query() filter: BaseFilter, @Res() response: Response) {
    const res = await this.categoryService.list(filter);
    response.status(res.code).send(res);
  }

  // Registered before ':id' - otherwise "dropdown" would be captured as an id.
  // Ungated: other already-permitted features (e.g. picking a category while
  // creating an inventory item) need this without needing category.view.
  @Get('dropdown')
  async listForDropdown(
    @Query() filter: CategoryDropdownFilter,
    @Res() response: Response,
  ) {
    const res = await this.categoryService.listForDropdown(filter);
    response.status(res.code).send(res);
  }

  @Get(':id')
  @AuthPermissions('inventory.category.view')
  @ApiParam({ name: 'id', type: String })
  async getById(@Param('id') id: string, @Res() response: Response) {
    const res = await this.categoryService.getById(id);
    response.status(res.code).send(res);
  }

  @Post()
  @AuthPermissions('inventory.category.create')
  @AuditLog('Category', 'Created')
  async create(@Body() request: CategoryRequest, @Res() response: Response) {
    const res = await this.categoryService.create(request);
    response.status(res.code).send(res);
  }

  @Patch(':id')
  @AuthPermissions('inventory.category.update')
  @AuditLog('Category', 'Updated')
  @ApiParam({ name: 'id', type: String })
  async update(
    @Param('id') id: string,
    @Body() request: CategoryRequest,
    @Res() response: Response,
  ) {
    const res = await this.categoryService.update(id, request);
    response.status(res.code).send(res);
  }

  @Delete(':id')
  @AuthPermissions('inventory.category.delete')
  @AuditLog('Category', 'Deleted')
  @ApiParam({ name: 'id', type: String })
  async delete(@Param('id') id: string, @Res() response: Response) {
    const res = await this.categoryService.delete(id);
    response.status(res.code).send(res);
  }
}
