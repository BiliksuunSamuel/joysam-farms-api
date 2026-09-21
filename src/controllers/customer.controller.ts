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
import { CustomerFilter } from 'src/dtos/customer/customer.filter.dto';
import { CustomerRequest } from 'src/dtos/customer/customer.request.dto';
import { AuditLog } from 'src/decorators/audit-log.decorator';
import { AuthPermissions } from 'src/middlewares/auth.permissions';
import { AuditLogInterceptor } from 'src/providers/audit-log.interceptor';
import { JwtAuthGuard } from 'src/providers/jwt-auth..guard';
import { CustomerService } from 'src/services/customer.service';

@Controller('api/customers')
@ApiTags('Customers')
@ApiBearerAuth('Authorization')
@UseGuards(JwtAuthGuard)
@UseInterceptors(AuditLogInterceptor)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  @AuthPermissions('customer.view')
  async list(@Query() filter: CustomerFilter, @Res() response: Response) {
    const res = await this.customerService.list(filter);
    response.status(res.code).send(res);
  }

  @Get(':id')
  @AuthPermissions('customer.view')
  @ApiParam({ name: 'id', type: String })
  async getById(@Param('id') id: string, @Res() response: Response) {
    const res = await this.customerService.getById(id);
    response.status(res.code).send(res);
  }

  @Post()
  @AuthPermissions('customer.create')
  @AuditLog('Customer', 'Created')
  async create(@Body() request: CustomerRequest, @Res() response: Response) {
    const res = await this.customerService.create(request);
    response.status(res.code).send(res);
  }

  @Patch(':id')
  @AuthPermissions('customer.update')
  @AuditLog('Customer', 'Updated')
  @ApiParam({ name: 'id', type: String })
  async update(
    @Param('id') id: string,
    @Body() request: CustomerRequest,
    @Res() response: Response,
  ) {
    const res = await this.customerService.update(id, request);
    response.status(res.code).send(res);
  }
}
