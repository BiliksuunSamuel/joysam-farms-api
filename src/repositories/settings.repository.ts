import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SettingsRequest } from 'src/dtos/settings/settings.request.dto';
import { UserInfo } from 'src/models/user/user-info.model';
import { Settings } from 'src/schemas/settings.schema';
import { generateId } from 'src/utils';

@Injectable()
export class SettingsRepository {
  constructor(
    @InjectModel(Settings.name)
    private readonly settingsRepository: Model<Settings>,
  ) {}

  //there's only ever one document
  async get(): Promise<Settings> {
    return await this.settingsRepository.findOne({}).lean();
  }

  //create it on first save, update it every time after
  async upsert(
    request: SettingsRequest,
    updatedByInfoSnapshot?: UserInfo,
  ): Promise<Settings> {
    return await this.settingsRepository
      .findOneAndUpdate(
        {},
        {
          $set: { ...request, updatedAt: new Date(), updatedByInfoSnapshot },
          $setOnInsert: { id: generateId() },
        },
        { new: true, upsert: true },
      )
      .lean();
  }
}
