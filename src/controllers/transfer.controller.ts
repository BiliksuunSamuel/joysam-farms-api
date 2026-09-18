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
import { TransferFilter } from 'src/dtos/transfer/transfer.filter.dto';
import { TransferRequest } from 'src/dtos/transfer/transfer.request.dto';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { AuditLog } from 'src/decorators/audit-log.decorator';
import { AuthUser } from 'src/extensions/auth.extensions';
import { AuthPermissions } from 'src/middlewares/auth.permissions';
import { AuditLogInterceptor } from 'src/providers/audit-log.interceptor';
import { JwtAuthGuard } from 'src/providers/jwt-auth..guard';
import { TransferService } from 'src/services/transfer.service';

@Controller('api/transfers')
@ApiTags('Transfers')
@ApiBearerAuth('Authorization')
@UseInterceptors(AuditLogInterceptor)
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  @Get()
  @AuthPermissions('stock.transfer.view')
  async list(
    @Query() filter: TransferFilter,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.transferService.list(filter, user.id);
    response.status(res.code).send(res);
  }

  @Get(':id')
  @AuthPermissions('stock.transfer.view')
  @ApiParam({ name: 'id', type: String })
  async getById(
    @Param('id') id: string,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.transferService.getById(id, user.id);
    response.status(res.code).send(res);
  }

  //initiate a transfer - any authenticated user (e.g. a shop manager moving
  //stock, or the super manager stocking a shop from the warehouse)
  @Post()
  @UseGuards(JwtAuthGuard)
  @AuditLog('Transfer', 'Created')
  async create(
    @Body() request: TransferRequest,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.transferService.create(request, user.id);
    response.status(res.code).send(res);
  }

  @Patch(':id/complete')
  @AuthPermissions('stock.transfer.complete')
  @AuditLog('Transfer', 'Completed')
  @ApiParam({ name: 'id', type: String })
  async complete(
    @Param('id') id: string,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.transferService.complete(id, user.id);
    response.status(res.code).send(res);
  }

  @Patch(':id/cancel')
  @AuthPermissions('stock.transfer.cancel')
  @AuditLog('Transfer', 'Cancelled')
  @ApiParam({ name: 'id', type: String })
  async cancel(
    @Param('id') id: string,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.transferService.cancel(id, user.id);
    response.status(res.code).send(res);
  }
}
