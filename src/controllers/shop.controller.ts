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
import { ShopDropdownFilter } from 'src/dtos/shop/shop.dropdown.filter.dto';
import { ShopRequest } from 'src/dtos/shop/shop.request.dto';
import { AuditLog } from 'src/decorators/audit-log.decorator';
import { AuthPermissions } from 'src/middlewares/auth.permissions';
import { AuditLogInterceptor } from 'src/providers/audit-log.interceptor';
import { ShopService } from 'src/services/shop.service';

@Controller('api/shops')
@ApiTags('Shops')
@UseInterceptors(AuditLogInterceptor)
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  @Get()
  @AuthPermissions('shop.view')
  async list(@Query() filter: BaseFilter, @Res() response: Response) {
    const res = await this.shopService.list(filter);
    response.status(res.code).send(res);
  }

  // Registered before ':id' - otherwise "dropdown" would be captured as an id.
  // Ungated: other already-permitted features (e.g. assigning an employee's
  // location) need to pick a shop without needing shop.view themselves.
  @Get('dropdown')
  async listForDropdown(
    @Query() filter: ShopDropdownFilter,
    @Res() response: Response,
  ) {
    const res = await this.shopService.listForDropdown(filter);
    response.status(res.code).send(res);
  }

  @Get(':id')
  @AuthPermissions('shop.view')
  @ApiParam({ name: 'id', type: String })
  async getById(@Param('id') id: string, @Res() response: Response) {
    const res = await this.shopService.getById(id);
    response.status(res.code).send(res);
  }

  @Post()
  @AuthPermissions('shop.create')
  @AuditLog('Shop', 'Created')
  async create(@Body() request: ShopRequest, @Res() response: Response) {
    const res = await this.shopService.create(request);
    response.status(res.code).send(res);
  }

  @Patch(':id')
  @AuthPermissions('shop.update')
  @AuditLog('Shop', 'Updated')
  @ApiParam({ name: 'id', type: String })
  async update(
    @Param('id') id: string,
    @Body() request: ShopRequest,
    @Res() response: Response,
  ) {
    const res = await this.shopService.update(id, request);
    response.status(res.code).send(res);
  }

  @Delete(':id')
  @AuthPermissions('shop.delete')
  @AuditLog('Shop', 'Deleted')
  @ApiParam({ name: 'id', type: String })
  async delete(@Param('id') id: string, @Res() response: Response) {
    const res = await this.shopService.delete(id);
    response.status(res.code).send(res);
  }
}
