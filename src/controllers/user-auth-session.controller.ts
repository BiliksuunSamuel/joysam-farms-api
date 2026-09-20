import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { UserAuthSessionFilter } from 'src/dtos/user-auth-session/user-auth-session.filter.dto';
import { AuthPermissions } from 'src/middlewares/auth.permissions';
import { AuditLogInterceptor } from 'src/providers/audit-log.interceptor';
import { JwtAuthGuard } from 'src/providers/jwt-auth..guard';
import { UserAuthSessionService } from 'src/services/user-auth-session.service';

@Controller('api/sessions')
@ApiTags('Sessions')
@ApiBearerAuth('Authorization')
@UseGuards(JwtAuthGuard)
@UseInterceptors(AuditLogInterceptor)
export class UserAuthSessionController {
  constructor(
    private readonly userAuthSessionService: UserAuthSessionService,
  ) {}

  @Get()
  @AuthPermissions('session.view')
  async list(
    @Query() filter: UserAuthSessionFilter,
    @Res() response: Response,
  ) {
    const res = await this.userAuthSessionService.list(filter);
    response.status(res.code).send(res);
  }
}
