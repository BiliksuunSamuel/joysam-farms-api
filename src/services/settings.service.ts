import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/dtos/common/api.response.dto';
import { SettingsRequest } from 'src/dtos/settings/settings.request.dto';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { SettingsRepository } from 'src/repositories/settings.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { Settings } from 'src/schemas/settings.schema';
import { ImageService } from 'src/services/image.service';
import { toUserInfo } from 'src/utils';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  constructor(
    private readonly settingsRepository: SettingsRepository,
    private readonly userRepository: UserRepository,
    private readonly imageService: ImageService,
  ) {}

  //the platform hasn't necessarily been configured yet, so this can 404 -
  //that's a normal, expected state for a brand-new install, not an error
  async get(): Promise<ApiResponseDto<Settings>> {
    try {
      const settings = await this.settingsRepository.get();
      if (!settings) {
        return CommonResponses.NotFoundResponse<Settings>(
          'Settings have not been configured yet',
        );
      }
      return CommonResponses.OkResponse<Settings>(settings);
    } catch (error) {
      this.logger.error('an error occurred while getting settings', error);
      return CommonResponses.InternalServerErrorResponse<Settings>(
        'An error occurred while getting settings',
      );
    }
  }

  async update(
    request: SettingsRequest,
    updatedById: string,
  ): Promise<ApiResponseDto<Settings>> {
    try {
      const updatedByUser = await this.userRepository.getById(updatedById);
      const settings = await this.settingsRepository.upsert(
        request,
        updatedByUser ? toUserInfo(updatedByUser) : undefined,
      );
      return CommonResponses.OkResponse<Settings>(settings);
    } catch (error) {
      this.logger.error(
        'an error occurred while updating settings',
        request,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<Settings>(
        'An error occurred while updating settings',
      );
    }
  }

  async updateLogo(
    file: Express.Multer.File,
    updatedById: string,
  ): Promise<ApiResponseDto<Settings>> {
    try {
      const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
      const uploaded = await this.imageService.cloudinaryUpload(
        dataUri,
        'BusinessProfile',
      );
      if (!uploaded) {
        return CommonResponses.InternalServerErrorResponse<Settings>(
          'Could not upload the logo. Please try again.',
        );
      }
      const updatedByUser = await this.userRepository.getById(updatedById);
      const settings = await this.settingsRepository.upsert(
        { logo: uploaded.secure_url },
        updatedByUser ? toUserInfo(updatedByUser) : undefined,
      );
      return CommonResponses.OkResponse<Settings>(settings);
    } catch (error) {
      this.logger.error(
        'an error occurred while uploading the business logo',
        error,
      );
      return CommonResponses.InternalServerErrorResponse<Settings>(
        'An error occurred while uploading the logo',
      );
    }
  }
}
