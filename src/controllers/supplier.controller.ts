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
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import { SupplierDropdownFilter } from 'src/dtos/supplier/supplier.dropdown.filter.dto';
import { SupplierRequest } from 'src/dtos/supplier/supplier.request.dto';
import { AuditLog } from 'src/decorators/audit-log.decorator';
import { AuthPermissions } from 'src/middlewares/auth.permissions';
import { AuditLogInterceptor } from 'src/providers/audit-log.interceptor';
import { SupplierService } from 'src/services/supplier.service';

@Controller('api/suppliers')
@ApiTags('Suppliers')
@UseInterceptors(AuditLogInterceptor)
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @Get()
  @AuthPermissions('supplier.view')
  async list(@Query() filter: BaseFilter, @Res() response: Response) {
    const res = await this.supplierService.list(filter);
    response.status(res.code).send(res);
  }

  // Registered before ':id' - otherwise "dropdown" would be captured as an id.
  // Ungated: other already-permitted features (e.g. picking a supplier while
  // creating a supply request) need this without needing supplier.view.
  @Get('dropdown')
  async listForDropdown(
    @Query() filter: SupplierDropdownFilter,
    @Res() response: Response,
  ) {
    const res = await this.supplierService.listForDropdown(filter);
    response.status(res.code).send(res);
  }

  @Get(':id')
  @AuthPermissions('supplier.view')
  @ApiParam({ name: 'id', type: String })
  async getById(@Param('id') id: string, @Res() response: Response) {
    const res = await this.supplierService.getById(id);
    response.status(res.code).send(res);
  }

  @Post()
  @AuthPermissions('supplier.create')
  @AuditLog('Supplier', 'Created')
  async create(@Body() request: SupplierRequest, @Res() response: Response) {
    const res = await this.supplierService.create(request);
    response.status(res.code).send(res);
  }

  @Patch(':id')
  @AuthPermissions('supplier.update')
  @AuditLog('Supplier', 'Updated')
  @ApiParam({ name: 'id', type: String })
  async update(
    @Param('id') id: string,
    @Body() request: SupplierRequest,
    @Res() response: Response,
  ) {
    const res = await this.supplierService.update(id, request);
    response.status(res.code).send(res);
  }

  @Delete(':id')
  @AuthPermissions('supplier.delete')
  @AuditLog('Supplier', 'Deleted')
  @ApiParam({ name: 'id', type: String })
  async delete(@Param('id') id: string, @Res() response: Response) {
    const res = await this.supplierService.delete(id);
    response.status(res.code).send(res);
  }
}
