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
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { ShopInventoryBreakdownFilter } from 'src/dtos/shop-inventory/shop-inventory.breakdown.filter.dto';
import { ShopInventoryFilter } from 'src/dtos/shop-inventory/shop-inventory.filter.dto';
import { ShopInventoryQuantityRequest } from 'src/dtos/shop-inventory/shop-inventory.quantity.request.dto';
import { ShopInventoryRequest } from 'src/dtos/shop-inventory/shop-inventory.request.dto';
import { ShopInventoryStatusRequest } from 'src/dtos/shop-inventory/shop-inventory.status.request.dto';
import { AuditLog } from 'src/decorators/audit-log.decorator';
import { AuthUser } from 'src/extensions/auth.extensions';
import { AuthPermissions } from 'src/middlewares/auth.permissions';
import { AuditLogInterceptor } from 'src/providers/audit-log.interceptor';
import { ShopInventoryService } from 'src/services/shop-inventory.service';

@Controller('api/shop-inventory')
@ApiTags('Shop Inventory')
@UseInterceptors(AuditLogInterceptor)
export class ShopInventoryController {
  constructor(private readonly shopInventoryService: ShopInventoryService) {}

  @Get()
  @AuthPermissions('shop.inventory.view')
  async list(
    @Query() filter: ShopInventoryFilter,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.shopInventoryService.list(filter, user.id);
    response.status(res.code).send(res);
  }

  @Get('breakdown')
  @AuthPermissions('shop.inventory.view')
  async getBreakdown(
    @Query() filter: ShopInventoryBreakdownFilter,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.shopInventoryService.getBreakdown(filter, user.id);
    response.status(res.code).send(res);
  }

  @Get(':id')
  @AuthPermissions('shop.inventory.view')
  @ApiParam({ name: 'id', type: String })
  async getById(
    @Param('id') id: string,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.shopInventoryService.getById(id, user.id);
    response.status(res.code).send(res);
  }

  @Post()
  @AuthPermissions('shop.inventory.create')
  @AuditLog('ShopInventory', 'Created')
  async create(
    @Body() request: ShopInventoryRequest,
    @Res() response: Response,
  ) {
    const res = await this.shopInventoryService.create(request);
    response.status(res.code).send(res);
  }

  @Patch(':id/quantity')
  @AuthPermissions('shop.inventory.adjust-quantity')
  @AuditLog('ShopInventory', 'QuantityUpdated')
  @ApiParam({ name: 'id', type: String })
  async updateQuantity(
    @Param('id') id: string,
    @Body() request: ShopInventoryQuantityRequest,
    @Res() response: Response,
  ) {
    const res = await this.shopInventoryService.updateQuantity(id, request);
    response.status(res.code).send(res);
  }

  @Patch(':id/status')
  @AuthPermissions('shop.inventory.update-status')
  @AuditLog('ShopInventory', 'StatusUpdated')
  @ApiParam({ name: 'id', type: String })
  async updateStatus(
    @Param('id') id: string,
    @Body() request: ShopInventoryStatusRequest,
    @Res() response: Response,
  ) {
    const res = await this.shopInventoryService.updateStatus(id, request);
    response.status(res.code).send(res);
  }

  @Delete(':id')
  @AuthPermissions('shop.inventory.delete')
  @AuditLog('ShopInventory', 'Deleted')
  @ApiParam({ name: 'id', type: String })
  async delete(@Param('id') id: string, @Res() response: Response) {
    const res = await this.shopInventoryService.delete(id);
    response.status(res.code).send(res);
  }
}
