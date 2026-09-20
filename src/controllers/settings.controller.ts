import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { SettingsRequest } from 'src/dtos/settings/settings.request.dto';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { AuditLog } from 'src/decorators/audit-log.decorator';
import { AuthUser } from 'src/extensions/auth.extensions';
import { AuthPermissions } from 'src/middlewares/auth.permissions';
import { AuditLogInterceptor } from 'src/providers/audit-log.interceptor';
import { SettingsService } from 'src/services/settings.service';

const LOGO_MAX_BYTES = 2 * 1024 * 1024;

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

  @Post('logo')
  @AuthPermissions('settings.update')
  @AuditLog('Settings', 'Updated')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: LOGO_MAX_BYTES } }),
  )
  async uploadLogo(
    @UploadedFile() file: Express.Multer.File,
    @AuthUser() user: UserJwtDetails,
    @Res() response: Response,
  ) {
    if (!file || !file.mimetype?.startsWith('image/')) {
      response
        .status(400)
        .send({ code: 400, message: 'Please upload an image file.' });
      return;
    }
    const res = await this.settingsService.updateLogo(file, user.id);
    response.status(res.code).send(res);
  }
}
