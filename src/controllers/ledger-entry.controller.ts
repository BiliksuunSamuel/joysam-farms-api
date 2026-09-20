import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { LedgerAdjustmentRequest } from 'src/dtos/ledger-entry/ledger-adjustment.request.dto';
import { LedgerEntryFilter } from 'src/dtos/ledger-entry/ledger-entry.filter.dto';
import { LedgerTrendFilter } from 'src/dtos/ledger-entry/ledger.trend.filter.dto';
import { AuditLog } from 'src/decorators/audit-log.decorator';
import { AuthUser } from 'src/extensions/auth.extensions';
import { AuthPermissions } from 'src/middlewares/auth.permissions';
import { AuditLogInterceptor } from 'src/providers/audit-log.interceptor';
import { JwtAuthGuard } from 'src/providers/jwt-auth..guard';
import { LedgerEntryService } from 'src/services/ledger-entry.service';

@Controller('api/ledger')
@ApiTags('Ledger')
@ApiBearerAuth('Authorization')
@UseGuards(JwtAuthGuard)
@UseInterceptors(AuditLogInterceptor)
export class LedgerEntryController {
  constructor(private readonly ledgerEntryService: LedgerEntryService) {}

  @Get()
  @AuthPermissions('ledger.view')
  async list(
    @Query() filter: LedgerEntryFilter,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.ledgerEntryService.list(filter, user.id);
    response.status(res.code).send(res);
  }

  @Get('trend')
  @AuthPermissions('ledger.view')
  async getTrend(
    @Query() filter: LedgerTrendFilter,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.ledgerEntryService.getTrend(filter, user.id);
    response.status(res.code).send(res);
  }

  // Registered before ':id' - otherwise "summary" would be captured as an id.
  @Get('summary')
  @AuthPermissions('ledger.view')
  async getSummary(
    @Query('shopId') shopId: string,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.ledgerEntryService.getSummary(shopId, user.id);
    response.status(res.code).send(res);
  }

  @Get(':id')
  @AuthPermissions('ledger.view')
  @ApiParam({ name: 'id', type: String })
  async getById(
    @Param('id') id: string,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.ledgerEntryService.getById(id, user.id);
    response.status(res.code).send(res);
  }

  //the only way to post a ledger entry directly, rather than as a side
  //effect of another feature (e.g. an expense being marked paid)
  @Post('adjustments')
  @AuthPermissions('ledger.adjust')
  @AuditLog('LedgerEntry', 'Adjusted')
  async adjust(
    @Body() request: LedgerAdjustmentRequest,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.ledgerEntryService.adjust(request, user.id);
    response.status(res.code).send(res);
  }
}
