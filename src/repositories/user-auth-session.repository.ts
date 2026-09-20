import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import configuration from 'src/configuration';
import { UserAuthSessionFilter } from 'src/dtos/user-auth-session/user-auth-session.filter.dto';
import { UserAuthSessionStatus } from 'src/enums';
import { UserAuthSession } from 'src/schemas/user-auth-session.schema';
import { generateId, toPaginationInfo } from 'src/utils';

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
      expiresAt: new Date(
        Date.now() + configuration().sessionTimeoutMinutes * 60_000,
      ),
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
  //request so the inactivity timeout has something to measure against.
  //Also pushes expiresAt out by the same amount, so a session that's kept
  //in continuous use never trips the sweep below.
  async touch(tokenId: string): Promise<void> {
    const now = new Date();
    await this.userAuthSessionRepository.updateOne(
      { tokenId },
      {
        $set: {
          lastActiveAt: now,
          expiresAt: new Date(
            now.getTime() + configuration().sessionTimeoutMinutes * 60_000,
          ),
        },
      },
    );
  }

  //sets expiresAt on any Active session that predates this field (e.g.
  //rows created before this migration) so the sweep can catch them too -
  //self-healing, runs every sweep, a no-op once every row has the field.
  //Falls back to createdAt for the handful of even older rows that predate
  //lastActiveAt itself.
  async backfillMissingExpiry(): Promise<number> {
    const res = await this.userAuthSessionRepository.updateMany(
      { status: UserAuthSessionStatus.Active, expiresAt: null },
      [
        {
          $set: {
            expiresAt: {
              $add: [
                { $ifNull: ['$lastActiveAt', '$createdAt'] },
                configuration().sessionTimeoutMinutes * 60_000,
              ],
            },
          },
        },
      ],
    );
    return res.modifiedCount;
  }

  //revokes every Active session past its expiresAt - the timer-driven
  //counterpart to AuthMiddleware's lazy check, for sessions that never make
  //another request after going stale.
  async sweepExpired(now: Date = new Date()): Promise<number> {
    const res = await this.userAuthSessionRepository.updateMany(
      {
        status: UserAuthSessionStatus.Active,
        expiresAt: { $ne: null, $lte: now },
      },
      { $set: { status: UserAuthSessionStatus.Revoked } },
    );
    return res.modifiedCount;
  }

  //paginated session/sign-in history across the whole platform, newest
  //first - for the Access Sessions page (see UserAuthSessionService).
  async list(
    filter: UserAuthSessionFilter,
  ): Promise<{ results: UserAuthSession[]; totalCount: number }> {
    const { page, pageSize } = toPaginationInfo(filter);
    const query: any = {};
    if (filter?.startDate || filter?.endDate) {
      query.createdAt = {};
      if (filter.startDate) query.createdAt.$gte = new Date(filter.startDate);
      if (filter.endDate) query.createdAt.$lte = new Date(filter.endDate);
    }

    const [results, totalCount] = await Promise.all([
      this.userAuthSessionRepository
        .find(query)
        .sort({ createdAt: -1, _id: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      this.userAuthSessionRepository.countDocuments(query),
    ]);

    return { results, totalCount };
  }
}
