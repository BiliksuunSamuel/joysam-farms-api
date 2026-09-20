import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/dtos/common/api.response.dto';
import { PagedResults } from 'src/dtos/common/paged.results.dto';
import { RecentSignInResponse } from 'src/dtos/user/recent-sign-in.response.dto';
import { UserAuthSessionFilter } from 'src/dtos/user-auth-session/user-auth-session.filter.dto';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { UserAuthSessionRepository } from 'src/repositories/user-auth-session.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { toPaginationInfo } from 'src/utils';

// Platform-wide sign-in/session history, for the Access Sessions page - not
// shop-scoped, since who's logging in from where is a security-monitoring
// concern across the whole business, same as the audit log.
@Injectable()
export class UserAuthSessionService {
  private readonly logger = new Logger(UserAuthSessionService.name);
  constructor(
    private readonly userAuthSessionRepository: UserAuthSessionRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async list(
    filter: UserAuthSessionFilter,
  ): Promise<ApiResponseDto<PagedResults<RecentSignInResponse>>> {
    try {
      const { page, pageSize } = toPaginationInfo(filter);
      const { results: sessions, totalCount } =
        await this.userAuthSessionRepository.list(filter);

      // Batch-resolved per page, not per session - avoids an N+1 lookup
      // when several sessions on the same page belong to the same user.
      const userCache = new Map<string, string>();
      const results: RecentSignInResponse[] = [];
      for (const session of sessions) {
        let name = userCache.get(session.userId);
        if (name === undefined) {
          const user = await this.userRepository.getById(session.userId);
          name = user?.name ?? 'Unknown user';
          userCache.set(session.userId, name);
        }
        results.push({
          userId: session.userId,
          name,
          signedInAt: session.createdAt,
          ipAddress: session.ipAddress,
          status: session.status,
        });
      }

      return CommonResponses.OkResponse<PagedResults<RecentSignInResponse>>({
        results,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error('an error occurred while listing sessions', error);
      return CommonResponses.InternalServerErrorResponse<
        PagedResults<RecentSignInResponse>
      >();
    }
  }
}
