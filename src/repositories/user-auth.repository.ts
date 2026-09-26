import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserAuth } from 'src/schemas/user-auth.schema';
import { generateId } from 'src/utils';

@Injectable()
export class UserAuthRepository {
  constructor(
    @InjectModel(UserAuth.name)
    private readonly userAuthRepository: Model<UserAuth>,
  ) {}

  //get by user id
  async getByUserId(userId: string): Promise<UserAuth> {
    return await this.userAuthRepository.findOne({ userId }).lean();
  }

  //get by username, so login can look up credentials in one query
  async getByUsername(username: string): Promise<UserAuth> {
    return await this.userAuthRepository.findOne({ username }).lean();
  }

  //create login credentials for a user
  async create(request: {
    userId: string;
    username: string;
    password: string;
    mustChangePassword?: boolean;
  }): Promise<UserAuth> {
    const res = await this.userAuthRepository.create({
      ...request,
      id: generateId(),
    });
    return await this.userAuthRepository.findById(res._id).lean();
  }

  //update password
  async updatePassword(
    userId: string,
    password: string,
    mustChangePassword = false,
  ): Promise<UserAuth> {
    return await this.userAuthRepository
      .findOneAndUpdate(
        { userId },
        { $set: { password, mustChangePassword } },
        { new: true },
      )
      .lean();
  }
}
