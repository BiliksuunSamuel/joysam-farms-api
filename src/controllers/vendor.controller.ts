import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { VendorFilter } from 'src/dtos/vendor/vendor.filter.dto';
import { VendorLedgerEntryFilter } from 'src/dtos/vendor/vendor-ledger-entry.filter.dto';
import { VendorPaymentRequest } from 'src/dtos/vendor/vendor.payment.request.dto';
import { VendorRequest } from 'src/dtos/vendor/vendor.request.dto';
import { AuditLog } from 'src/decorators/audit-log.decorator';
import { AuthUser } from 'src/extensions/auth.extensions';
import { AuthPermissions } from 'src/middlewares/auth.permissions';
import { AuditLogInterceptor } from 'src/providers/audit-log.interceptor';
import { JwtAuthGuard } from 'src/providers/jwt-auth..guard';
import { VendorService } from 'src/services/vendor.service';

@Controller('api/vendors')
@ApiTags('Vendors')
@ApiBearerAuth('Authorization')
@UseGuards(JwtAuthGuard)
@UseInterceptors(AuditLogInterceptor)
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Get()
  @AuthPermissions('vendor.view')
  async list(@Query() filter: VendorFilter, @Res() response: Response) {
    const res = await this.vendorService.list(filter);
    response.status(res.code).send(res);
  }

  @Get(':id')
  @AuthPermissions('vendor.view')
  @ApiParam({ name: 'id', type: String })
  async getById(@Param('id') id: string, @Res() response: Response) {
    const res = await this.vendorService.getById(id);
    response.status(res.code).send(res);
  }

  @Get(':id/ledger')
  @AuthPermissions('vendor.view')
  @ApiParam({ name: 'id', type: String })
  async getLedger(
    @Param('id') id: string,
    @Query() filter: VendorLedgerEntryFilter,
    @Res() response: Response,
  ) {
    const res = await this.vendorService.getLedger({ ...filter, vendorId: id });
    response.status(res.code).send(res);
  }

  @Post()
  @AuthPermissions('vendor.create')
  @AuditLog('Vendor', 'Created')
  async create(@Body() request: VendorRequest, @Res() response: Response) {
    const res = await this.vendorService.create(request);
    response.status(res.code).send(res);
  }

  @Patch(':id')
  @AuthPermissions('vendor.update')
  @AuditLog('Vendor', 'Updated')
  @ApiParam({ name: 'id', type: String })
  async update(
    @Param('id') id: string,
    @Body() request: VendorRequest,
    @Res() response: Response,
  ) {
    const res = await this.vendorService.update(id, request);
    response.status(res.code).send(res);
  }

  @Post(':id/payments')
  @AuthPermissions('vendor.payment.record')
  @AuditLog('Vendor', 'PaymentRecorded')
  @ApiParam({ name: 'id', type: String })
  async recordPayment(
    @Param('id') id: string,
    @Body() request: VendorPaymentRequest,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.vendorService.recordPayment(id, request, user.id);
    response.status(res.code).send(res);
  }
}
