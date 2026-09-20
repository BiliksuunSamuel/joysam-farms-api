import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NextFunction, Request, Response } from 'express';
import configuration from 'src/configuration';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { UserAuthSessionStatus, UserStatus } from 'src/enums';
import { UserAuthSessionRepository } from 'src/repositories/user-auth-session.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { toPaginationInfo } from 'src/utils';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuthMiddleware.name);
  constructor(
    private readonly jwtService: JwtService,
    private readonly userRepository: UserRepository,
    private readonly userAuthSessionRepository: UserAuthSessionRepository,
  ) {}
  async use(req: Request, res: Response, next: NextFunction) {
    const token = req.headers.authorization?.split(' ')[1];
    const query = req.query;
    if (query) {
      const paginationInfo = toPaginationInfo(query);
      req.query['page'] = paginationInfo.page as any;
      req.query['pageSize'] = paginationInfo.pageSize as any;
      this.logger.log('request query details', req.query);
    }
    if (token) {
      try {
        const decondedToken =
          await this.jwtService.verifyAsync<UserJwtDetails>(token);
        this.logger.debug('Decoded Token', decondedToken);
        const user = await this.userRepository.getById(decondedToken.id);
        if (!user || user.status !== UserStatus.Active) {
          return res.status(401).send({ message: 'Unauthorized' });
        }
        const session = await this.userAuthSessionRepository.getByTokenId(
          decondedToken.tokenId,
        );
        if (
          !session ||
          session.userId !== user.id ||
          session.status !== UserAuthSessionStatus.Active
        ) {
          return res.status(401).send({ message: 'Unauthorized' });
        }

        // Inactivity timeout, separate from the JWT's own fixed expiry -
        // a session goes stale if untouched for this long, even mid-token.
        // Same SESSION_TIMEOUT_MINUTES value the JWT itself was signed with.
        const timeoutMinutes = configuration().sessionTimeoutMinutes;
        const minutesSinceActive =
          (Date.now() - new Date(session.lastActiveAt).getTime()) / 60_000;
        if (minutesSinceActive > timeoutMinutes) {
          await this.userAuthSessionRepository.revoke(decondedToken.tokenId);
          return res
            .status(401)
            .send({ message: 'Session expired due to inactivity' });
        }
        await this.userAuthSessionRepository.touch(decondedToken.tokenId);
      } catch (error) {
        this.logger.error('Error in AuthMiddleware', error);
      }
    }
    next();
  }
}
