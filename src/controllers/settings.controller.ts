import {
  Body,
  Controller,
  Get,
  Patch,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { SettingsRequest } from 'src/dtos/settings/settings.request.dto';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { AuditLog } from 'src/decorators/audit-log.decorator';
import { AuthUser } from 'src/extensions/auth.extensions';
import { AuthPermissions } from 'src/middlewares/auth.permissions';
import { AuditLogInterceptor } from 'src/providers/audit-log.interceptor';
import { SettingsService } from 'src/services/settings.service';

//a singleton - there's only ever one settings document for the platform
@Controller('api/settings')
@ApiTags('Settings')
@ApiBearerAuth('Authorization')
@UseInterceptors(AuditLogInterceptor)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @AuthPermissions('settings.view')
  async get(@Res() response: Response) {
    const res = await this.settingsService.get();
    response.status(res.code).send(res);
  }

  @Patch()
  @AuthPermissions('settings.update')
  @AuditLog('Settings', 'Updated')
  async update(
    @Body() request: SettingsRequest,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    const res = await this.settingsService.update(request, user.id);
    response.status(res.code).send(res);
  }
}
