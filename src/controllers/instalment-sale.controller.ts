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
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuditLog } from 'src/decorators/audit-log.decorator';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import {
  InstalmentCancelRequest,
  InstalmentPaymentRequest,
} from 'src/dtos/instalment/instalment-payment.request.dto';
import { InstalmentStatus } from 'src/enums';
import { AuthUser } from 'src/extensions/auth.extensions';
import { AuthPermissions } from 'src/middlewares/auth.permissions';
import { AuditLogInterceptor } from 'src/providers/audit-log.interceptor';
import { InstalmentSaleService } from 'src/services/instalment-sale.service';

// Instalment sales are started through POST api/sales (with an
// instalmentPlanId) - this controller is for working with them afterwards.
@Controller('api/instalment-sales')
@ApiTags('Instalment sales')
@UseInterceptors(AuditLogInterceptor)
export class InstalmentSaleController {
  constructor(private readonly instalmentSaleService: InstalmentSaleService) {}

  @Get()
  @AuthPermissions('sale.view')
  async list(
    @Query() filter: BaseFilter & { status?: InstalmentStatus },
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.instalmentSaleService.list(filter, user.id);
    response.status(res.code).send(res);
  }

  @Get(':id')
  @AuthPermissions('sale.view')
  @ApiParam({ name: 'id', type: String })
  async detail(@Param('id') id: string, @Res() response: Response) {
    const res = await this.instalmentSaleService.detail(id);
    response.status(res.code).send(res);
  }

  @Post(':id/payments')
  @AuthPermissions('instalment.payment.record')
  @AuditLog('InstalmentSale', 'Payment recorded')
  @ApiParam({ name: 'id', type: String })
  async recordPayment(
    @Param('id') id: string,
    @Body() request: InstalmentPaymentRequest,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.instalmentSaleService.recordPayment(id, request, user.id);
    response.status(res.code).send(res);
  }

  @Post(':id/release')
  @AuthPermissions('instalment.release')
  @AuditLog('InstalmentSale', 'Goods released')
  @ApiParam({ name: 'id', type: String })
  async release(
    @Param('id') id: string,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.instalmentSaleService.release(id, user.id);
    response.status(res.code).send(res);
  }

  @Post(':id/cancel')
  @AuthPermissions('instalment.cancel')
  @AuditLog('InstalmentSale', 'Cancelled')
  @ApiParam({ name: 'id', type: String })
  async cancel(
    @Param('id') id: string,
    @Body() request: InstalmentCancelRequest,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.instalmentSaleService.cancel(id, request, user.id);
    response.status(res.code).send(res);
  }
}
