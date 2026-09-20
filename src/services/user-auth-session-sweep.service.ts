import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { UserAuthSessionRepository } from 'src/repositories/user-auth-session.repository';

// AuthMiddleware only revokes a stale session lazily, the moment it's used
// again - if the frontend's own inactivity timer logs the user out first (or
// the tab is just closed), nothing ever makes that request, and the session
// row is left saying Active forever. This sweep catches those on a timer
// instead, using the expiresAt each session carries (see UserAuthSession).
@Injectable()
export class UserAuthSessionSweepService {
  private readonly logger = new Logger(UserAuthSessionSweepService.name);
  constructor(
    private readonly userAuthSessionRepository: UserAuthSessionRepository,
  ) {}

  @Cron('*/5 * * * *')
  async sweepExpiredSessions() {
    const backfilled =
      await this.userAuthSessionRepository.backfillMissingExpiry();
    if (backfilled) {
      this.logger.log(`backfilled expiresAt on ${backfilled} session(s)`);
    }

    const revoked = await this.userAuthSessionRepository.sweepExpired();
    if (revoked) {
      this.logger.log(`revoked ${revoked} expired session(s)`);
    }
  }
}
