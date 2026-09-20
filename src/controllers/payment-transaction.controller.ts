import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { PaymentTransactionFilter } from 'src/dtos/payment-transaction/payment-transaction.filter.dto';
import { PaymentTransactionTrendFilter } from 'src/dtos/payment-transaction/payment-transaction.trend.filter.dto';
import { AuthUser } from 'src/extensions/auth.extensions';
import { AuthPermissions } from 'src/middlewares/auth.permissions';
import { AuditLogInterceptor } from 'src/providers/audit-log.interceptor';
import { PaymentTransactionService } from 'src/services/payment-transaction.service';

@Controller('api/payment-transactions')
@ApiTags('Payment Transactions')
@ApiBearerAuth('Authorization')
@UseInterceptors(AuditLogInterceptor)
export class PaymentTransactionController {
  constructor(
    private readonly paymentTransactionService: PaymentTransactionService,
  ) {}

  @Get()
  @AuthPermissions('payment-transaction.view')
  async list(
    @Query() filter: PaymentTransactionFilter,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.paymentTransactionService.list(filter, user.id);
    response.status(res.code).send(res);
  }

  @Get('trend')
  @AuthPermissions('payment-transaction.view')
  async getTrend(
    @Query() filter: PaymentTransactionTrendFilter,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.paymentTransactionService.getTrend(filter, user.id);
    response.status(res.code).send(res);
  }

  //fetches the authorizationUrl for a just-created Digital sale, so the
  //checkout page can redirect to Paystack's hosted checkout.
  @Get('by-sale/:saleId')
  @AuthPermissions('sale.create')
  @ApiParam({ name: 'saleId', type: String })
  async getBySaleId(
    @Param('saleId') saleId: string,
    @Res() response: Response,
  ) {
    const res = await this.paymentTransactionService.getBySaleId(saleId);
    response.status(res.code).send(res);
  }

  //polling this IS a confirmation attempt, not a passive read - it invokes
  //the same idempotent core the webhook uses, so the checkout confirmation
  //page works even if the webhook never arrives (e.g. in local dev, where
  //Paystack can't reach localhost at all).
  @Get(':reference/status')
  @AuthPermissions('sale.create')
  @ApiParam({ name: 'reference', type: String })
  async getStatus(
    @Param('reference') reference: string,
    @Res() response: Response,
  ) {
    const res =
      await this.paymentTransactionService.confirmDigitalPayment(reference);
    response.status(res.code).send(res);
  }
}
