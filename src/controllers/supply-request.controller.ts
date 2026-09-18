import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { SupplyRequestFilter } from 'src/dtos/supply-request/supply-request.filter.dto';
import { SupplyRequestRequest } from 'src/dtos/supply-request/supply-request.request.dto';
import { SupplyRequestReview } from 'src/dtos/supply-request/supply-request.review.dto';
import { AuditLog } from 'src/decorators/audit-log.decorator';
import { AuthUser } from 'src/extensions/auth.extensions';
import { AuthPermissions } from 'src/middlewares/auth.permissions';
import { AuditLogInterceptor } from 'src/providers/audit-log.interceptor';
import { SupplyRequestService } from 'src/services/supply-request.service';

@Controller('api/supply-requests')
@ApiTags('Supply Requests')
@ApiBearerAuth('Authorization')
@UseInterceptors(AuditLogInterceptor)
export class SupplyRequestController {
  constructor(private readonly supplyRequestService: SupplyRequestService) {}

  @Get()
  @AuthPermissions('supply.request.view')
  async list(@Query() filter: SupplyRequestFilter, @Res() response: Response) {
    const res = await this.supplyRequestService.list(filter);
    response.status(res.code).send(res);
  }

  @Get(':id')
  @AuthPermissions('supply.request.view')
  @ApiParam({ name: 'id', type: String })
  async getById(@Param('id') id: string, @Res() response: Response) {
    const res = await this.supplyRequestService.getById(id);
    response.status(res.code).send(res);
  }

  @Post()
  @AuthPermissions('supply.request.create')
  @AuditLog('SupplyRequest', 'Created')
  async create(
    @Body() request: SupplyRequestRequest,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.supplyRequestService.create(request, user.id);
    response.status(res.code).send(res);
  }

  @Patch(':id/approve')
  @AuthPermissions('supply.request.approve')
  @AuditLog('SupplyRequest', 'Approved')
  @ApiParam({ name: 'id', type: String })
  async approve(
    @Param('id') id: string,
    @Body() review: SupplyRequestReview,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.supplyRequestService.approve(id, user.id, review);
    response.status(res.code).send(res);
  }

  @Patch(':id/reject')
  @AuthPermissions('supply.request.reject')
  @AuditLog('SupplyRequest', 'Rejected')
  @ApiParam({ name: 'id', type: String })
  async reject(
    @Param('id') id: string,
    @Body() review: SupplyRequestReview,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.supplyRequestService.reject(id, user.id, review);
    response.status(res.code).send(res);
  }
}
