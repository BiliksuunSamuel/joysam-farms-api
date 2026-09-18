import {
  Body,
  Controller,
  Get,
  Param,
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
}
