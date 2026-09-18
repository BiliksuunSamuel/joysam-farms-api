import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserAuthSessionStatus } from 'src/enums';
import { UserAuthSession } from 'src/schemas/user-auth-session.schema';
import { generateId } from 'src/utils';

@Injectable()
export class UserAuthSessionRepository {
  constructor(
    @InjectModel(UserAuthSession.name)
    private readonly userAuthSessionRepository: Model<UserAuthSession>,
  ) {}

  //start a new session for a user
  async create(request: {
    userId: string;
    ipAddress?: string;
    agent?: string;
  }): Promise<UserAuthSession> {
    const tokenId = generateId();
    const res = await this.userAuthSessionRepository.create({
      ...request,
      id: tokenId,
      tokenId,
    });
    return await this.userAuthSessionRepository.findById(res._id).lean();
  }

  //get by tokenId, from a decoded JWT
  async getByTokenId(tokenId: string): Promise<UserAuthSession> {
    return await this.userAuthSessionRepository.findOne({ tokenId }).lean();
  }

  //revoke a session (logout, or an admin/user ending a specific device)
  async revoke(tokenId: string): Promise<UserAuthSession> {
    return await this.userAuthSessionRepository
      .findOneAndUpdate(
        { tokenId },
        { $set: { status: UserAuthSessionStatus.Revoked } },
        { new: true },
      )
      .lean();
  }

  //mark a session as active right now - called on every authenticated
  //request so the inactivity timeout has something to measure against
  async touch(tokenId: string): Promise<void> {
    await this.userAuthSessionRepository.updateOne(
      { tokenId },
      { $set: { lastActiveAt: new Date() } },
    );
  }

  //most recent sign-ins across the whole platform, newest first
  async listRecent(limit: number): Promise<UserAuthSession[]> {
    return await this.userAuthSessionRepository
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }
}
