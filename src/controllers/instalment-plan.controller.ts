import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AuditLog } from 'src/decorators/audit-log.decorator';
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import { InstalmentPlanRequest } from 'src/dtos/instalment/instalment-plan.request.dto';
import { AuthPermissions } from 'src/middlewares/auth.permissions';
import { AuditLogInterceptor } from 'src/providers/audit-log.interceptor';
import { InstalmentPlanService } from 'src/services/instalment-plan.service';

@Controller('api/instalment-plans')
@ApiTags('Instalment plans')
@UseInterceptors(AuditLogInterceptor)
export class InstalmentPlanController {
  constructor(private readonly planService: InstalmentPlanService) {}

  @Get()
  @AuthPermissions('instalment.plan.manage')
  async list(@Query() filter: BaseFilter, @Res() response: Response) {
    const res = await this.planService.list(filter);
    response.status(res.code).send(res);
  }

  // Registered before ':id'. Ungated: checkout's plan picker needs it
  // without needing to manage plans (same convention as services/active).
  @Get('active')
  async listActive(@Res() response: Response) {
    const res = await this.planService.listActive();
    response.status(res.code).send(res);
  }

  @Post()
  @AuthPermissions('instalment.plan.manage')
  @AuditLog('InstalmentPlan', 'Created')
  async create(@Body() request: InstalmentPlanRequest, @Res() response: Response) {
    const res = await this.planService.create(request);
    response.status(res.code).send(res);
  }

  @Patch(':id')
  @AuthPermissions('instalment.plan.manage')
  @AuditLog('InstalmentPlan', 'Updated')
  @ApiParam({ name: 'id', type: String })
  async update(
    @Param('id') id: string,
    @Body() request: InstalmentPlanRequest,
    @Res() response: Response,
  ) {
    const res = await this.planService.update(id, request);
    response.status(res.code).send(res);
  }

  @Delete(':id')
  @AuthPermissions('instalment.plan.manage')
  @AuditLog('InstalmentPlan', 'Deleted')
  @ApiParam({ name: 'id', type: String })
  async delete(@Param('id') id: string, @Res() response: Response) {
    const res = await this.planService.delete(id);
    response.status(res.code).send(res);
  }
}
