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
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { StockRequestFilter } from 'src/dtos/stock-request/stock-request.filter.dto';
import { StockRequestRequest } from 'src/dtos/stock-request/stock-request.request.dto';
import { StockRequestReview } from 'src/dtos/stock-request/stock-request.review.dto';
import { StockRequestTrendFilter } from 'src/dtos/stock-request/stock-request.trend.filter.dto';
import { AuditLog } from 'src/decorators/audit-log.decorator';
import { AuthUser } from 'src/extensions/auth.extensions';
import { AuthPermissions } from 'src/middlewares/auth.permissions';
import { AuditLogInterceptor } from 'src/providers/audit-log.interceptor';
import { StockRequestService } from 'src/services/stock-request.service';

@Controller('api/stock-requests')
@ApiTags('Stock Requests')
@ApiBearerAuth('Authorization')
@UseInterceptors(AuditLogInterceptor)
export class StockRequestController {
  constructor(private readonly stockRequestService: StockRequestService) {}

  @Get()
  @AuthPermissions('stock.request.view')
  async list(
    @Query() filter: StockRequestFilter,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.stockRequestService.list(filter, user.id);
    response.status(res.code).send(res);
  }

  @Get('trend')
  @AuthPermissions('stock.request.view')
  async getTrend(
    @Query() filter: StockRequestTrendFilter,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.stockRequestService.getTrend(filter, user.id);
    response.status(res.code).send(res);
  }

  @Get(':id')
  @AuthPermissions('stock.request.view')
  @ApiParam({ name: 'id', type: String })
  async getById(
    @Param('id') id: string,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.stockRequestService.getById(id, user.id);
    response.status(res.code).send(res);
  }

  @Post()
  @AuthPermissions('stock.request.create')
  @AuditLog('StockRequest', 'Created')
  async create(
    @Body() request: StockRequestRequest,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.stockRequestService.create(request, user.id);
    response.status(res.code).send(res);
  }

  @Patch(':id/approve')
  @AuthPermissions('stock.request.approve')
  @AuditLog('StockRequest', 'Approved')
  @ApiParam({ name: 'id', type: String })
  async approve(
    @Param('id') id: string,
    @Body() review: StockRequestReview,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.stockRequestService.approve(id, user.id, review);
    response.status(res.code).send(res);
  }

  @Patch(':id/reject')
  @AuthPermissions('stock.request.reject')
  @AuditLog('StockRequest', 'Rejected')
  @ApiParam({ name: 'id', type: String })
  async reject(
    @Param('id') id: string,
    @Body() review: StockRequestReview,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.stockRequestService.reject(id, user.id, review);
    response.status(res.code).send(res);
  }
}
