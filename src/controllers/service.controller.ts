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
import { BaseFilter } from 'src/dtos/common/base.filter.dto';
import { ServiceRequest } from 'src/dtos/service/service.request.dto';
import { AuditLog } from 'src/decorators/audit-log.decorator';
import { AuthPermissions } from 'src/middlewares/auth.permissions';
import { AuditLogInterceptor } from 'src/providers/audit-log.interceptor';
import { ServiceService } from 'src/services/service.service';

@Controller('api/services')
@ApiTags('Services')
@UseInterceptors(AuditLogInterceptor)
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  @Get()
  @AuthPermissions('service.view')
  async list(@Query() filter: BaseFilter, @Res() response: Response) {
    const res = await this.serviceService.list(filter);
    response.status(res.code).send(res);
  }

  // Registered before ':id' - otherwise "active" would be captured as an
  // id. Ungated: ringing up a service sale at checkout needs this without
  // needing service.view (same convention as Category's dropdown).
  @Get('active')
  async listActive(@Res() response: Response) {
    const res = await this.serviceService.listActive();
    response.status(res.code).send(res);
  }

  @Get(':id')
  @AuthPermissions('service.view')
  @ApiParam({ name: 'id', type: String })
  async getById(@Param('id') id: string, @Res() response: Response) {
    const res = await this.serviceService.getById(id);
    response.status(res.code).send(res);
  }

  @Post()
  @AuthPermissions('service.create')
  @AuditLog('Service', 'Created')
  async create(@Body() request: ServiceRequest, @Res() response: Response) {
    const res = await this.serviceService.create(request);
    response.status(res.code).send(res);
  }

  @Patch(':id')
  @AuthPermissions('service.update')
  @AuditLog('Service', 'Updated')
  @ApiParam({ name: 'id', type: String })
  async update(
    @Param('id') id: string,
    @Body() request: ServiceRequest,
    @Res() response: Response,
  ) {
    const res = await this.serviceService.update(id, request);
    response.status(res.code).send(res);
  }

  @Delete(':id')
  @AuthPermissions('service.delete')
  @AuditLog('Service', 'Deleted')
  @ApiParam({ name: 'id', type: String })
  async delete(@Param('id') id: string, @Res() response: Response) {
    const res = await this.serviceService.delete(id);
    response.status(res.code).send(res);
  }
}
