import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuditLog } from 'src/decorators/audit-log.decorator';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { SaleFilter } from 'src/dtos/sale/sale.filter.dto';
import { SaleRequest } from 'src/dtos/sale/sale.request.dto';
import { SalesTrendFilter } from 'src/dtos/sale/sales.trend.filter.dto';
import { VoidSaleRequest } from 'src/dtos/sale/void-sale.request.dto';
import { ReviewVoidRequest } from 'src/dtos/sale/review-void.request.dto';
import { VoidRequestFilter } from 'src/dtos/sale/void-request.filter.dto';
import { AuthUser } from 'src/extensions/auth.extensions';
import { AuthPermissions } from 'src/middlewares/auth.permissions';
import { AuditLogInterceptor } from 'src/providers/audit-log.interceptor';
import { SaleService } from 'src/services/sale.service';

@Controller('api/sales')
@ApiTags('Sales')
@ApiBearerAuth('Authorization')
@UseInterceptors(AuditLogInterceptor)
export class SaleController {
  constructor(private readonly saleService: SaleService) {}

  @Get()
  @AuthPermissions('sale.view')
  async list(
    @Query() filter: SaleFilter,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.saleService.list(filter, user.id);
    response.status(res.code).send(res);
  }

  // Registered before ':id' - otherwise "trend" would be captured as an id.
  @Get('trend')
  @AuthPermissions('sale.view')
  async getSalesTrend(
    @Query() filter: SalesTrendFilter,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.saleService.getSalesTrend(filter, user.id);
    response.status(res.code).send(res);
  }

  // Registered before ':id' - otherwise "stats" would be captured as an id.
  @Get('stats')
  @AuthPermissions('sale.view')
  async getStats(
    @Query() filter: SaleFilter,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.saleService.getStats(filter, user.id);
    response.status(res.code).send(res);
  }

  // Registered before ':id' - otherwise "void-requests" would be captured
  // as an id.
  @Get('void-requests')
  @AuthPermissions('sale.view')
  async listVoidRequests(
    @Query() filter: VoidRequestFilter,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.saleService.listVoidRequests(filter, user.id);
    response.status(res.code).send(res);
  }

  @Get(':id')
  @AuthPermissions('sale.view')
  @ApiParam({ name: 'id', type: String })
  async getById(
    @Param('id') id: string,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.saleService.getById(id, user.id);
    response.status(res.code).send(res);
  }

  //ring up a sale at checkout
  @Post()
  @AuthPermissions('sale.create')
  @AuditLog('Sale', 'Created')
  async create(
    @Body() request: SaleRequest,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.saleService.create(request, user.id);
    response.status(res.code).send(res);
  }

  //cashier requests a void - instant or pending approval, depending on
  //Settings.voidApprovalMode (see SaleService.requestVoid)
  @Post(':id/void')
  @AuthPermissions('sale.void.request')
  @AuditLog('Sale', 'VoidRequested')
  @ApiParam({ name: 'id', type: String })
  async requestVoid(
    @Param('id') id: string,
    @Body() request: VoidSaleRequest,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.saleService.requestVoid(id, user.id, request);
    response.status(res.code).send(res);
  }

  @Patch(':id/void/approve')
  @AuthPermissions('sale.void.approve')
  @AuditLog('Sale', 'VoidApproved')
  @ApiParam({ name: 'id', type: String })
  async approveVoid(
    @Param('id') id: string,
    @Body() request: ReviewVoidRequest,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.saleService.approveVoid(id, user.id, request);
    response.status(res.code).send(res);
  }

  @Patch(':id/void/reject')
  @AuthPermissions('sale.void.reject')
  @AuditLog('Sale', 'VoidRejected')
  @ApiParam({ name: 'id', type: String })
  async rejectVoid(
    @Param('id') id: string,
    @Body() request: ReviewVoidRequest,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.saleService.rejectVoid(id, user.id, request);
    response.status(res.code).send(res);
  }
}
