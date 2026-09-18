import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuditLogFilter } from 'src/dtos/audit-log/audit-log.filter.dto';
import { AuthPermissions } from 'src/middlewares/auth.permissions';
import { JwtAuthGuard } from 'src/providers/jwt-auth..guard';
import { AuditLogService } from 'src/services/audit-log.service';

//read-only: entries are only ever created as a side effect of another
//action (see AuditLogInterceptor), never posted directly via the API
@Controller('api/audit-logs')
@ApiTags('Audit Logs')
@ApiBearerAuth('Authorization')
@UseGuards(JwtAuthGuard)
@AuthPermissions('audit.view')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async list(@Query() filter: AuditLogFilter, @Res() response: Response) {
    const res = await this.auditLogService.list(filter);
    response.status(res.code).send(res);
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: String })
  async getById(@Param('id') id: string, @Res() response: Response) {
    const res = await this.auditLogService.getById(id);
    response.status(res.code).send(res);
  }
}
