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
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { DailyReportFilter } from 'src/dtos/daily-report/daily-report.filter.dto';
import { DailyReportGenerateRequest } from 'src/dtos/daily-report/daily-report.generate.request.dto';
import { AuditLog } from 'src/decorators/audit-log.decorator';
import { AuthUser } from 'src/extensions/auth.extensions';
import { AuthPermissions } from 'src/middlewares/auth.permissions';
import { AuditLogInterceptor } from 'src/providers/audit-log.interceptor';
import { DailyReportService } from 'src/services/daily-report.service';

@Controller('api/daily-reports')
@ApiTags('Daily Reports')
@ApiBearerAuth('Authorization')
@UseInterceptors(AuditLogInterceptor)
export class DailyReportController {
  constructor(private readonly dailyReportService: DailyReportService) {}

  @Get()
  @AuthPermissions('daily-report.view')
  async list(
    @Query() filter: DailyReportFilter,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.dailyReportService.list(filter, user.id);
    response.status(res.code).send(res);
  }

  // Static-prefixed 'shop/:shopId/:date' vs 'org/:date' rather than one
  // route with an optional param - a path segment can't express "omitted =
  // organisation-wide" the way a query param can.
  @Get('shop/:shopId/:date')
  @AuthPermissions('daily-report.view')
  @ApiParam({ name: 'shopId', type: String })
  @ApiParam({ name: 'date', type: String })
  async getForShop(
    @Param('shopId') shopId: string,
    @Param('date') date: string,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.dailyReportService.getForShop(shopId, date, user.id);
    response.status(res.code).send(res);
  }

  @Get('org/:date')
  @AuthPermissions('daily-report.view')
  @ApiParam({ name: 'date', type: String })
  async getOrgWide(
    @Param('date') date: string,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.dailyReportService.getOrgWide(date, user.id);
    response.status(res.code).send(res);
  }

  @Post('generate')
  @AuthPermissions('daily-report.generate')
  @AuditLog('DailyReport', 'Generated')
  async generate(
    @Body() request: DailyReportGenerateRequest,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.dailyReportService.generate(request, user.id);
    response.status(res.code).send(res);
  }
}
