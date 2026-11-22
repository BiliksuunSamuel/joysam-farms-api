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
import { AuditLog } from 'src/decorators/audit-log.decorator';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { DayCloseFilter } from 'src/dtos/day-close/day-close.filter.dto';
import { DayCloseRequest } from 'src/dtos/day-close/day-close.request.dto';
import { AuthUser } from 'src/extensions/auth.extensions';
import { AuthPermissions } from 'src/middlewares/auth.permissions';
import { AuditLogInterceptor } from 'src/providers/audit-log.interceptor';
import { JwtAuthGuard } from 'src/providers/jwt-auth..guard';
import { DayCloseService } from 'src/services/day-close.service';

@Controller('api/day-closes')
@ApiTags('Day closes')
@ApiBearerAuth('Authorization')
@UseInterceptors(AuditLogInterceptor)
export class DayCloseController {
  constructor(private readonly dayCloseService: DayCloseService) {}

  // What the system expects for the caller's own day - the closing screen.
  @Get('preview')
  @AuthPermissions('dayclose.create')
  async preview(
    @Query('shopId') shopId: string | undefined,
    @Query('date') date: string | undefined,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.dayCloseService.preview(user.id, shopId, date);
    response.status(res.code).send(res);
  }

  // Registered before ':id'. Who still has to close, per shop.
  @Get('status')
  @AuthPermissions('dayclose.view')
  async status(
    @Query('date') date: string | undefined,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.dayCloseService.status(user.id, date);
    response.status(res.code).send(res);
  }

  @Post()
  @AuthPermissions('dayclose.create')
  @AuditLog('DayClose', 'Closed')
  async close(
    @Body() request: DayCloseRequest,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.dayCloseService.close(request, user.id);
    response.status(res.code).send(res);
  }

  // Open to anyone signed in: the service decides between "your own closes"
  // (dayclose.create) and "the shop's" (dayclose.view).
  @Get()
  @UseGuards(JwtAuthGuard)
  async list(
    @Query() filter: DayCloseFilter,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.dayCloseService.list(filter, user.id);
    response.status(res.code).send(res);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', type: String })
  async get(
    @Param('id') id: string,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.dayCloseService.getById(id, user.id);
    response.status(res.code).send(res);
  }
}
