import { Injectable, Logger } from '@nestjs/common';
import { ApiResponseDto } from 'src/dtos/common/api.response.dto';
import { DropdownOption } from 'src/dtos/common/dropdown.option.dto';
import { PagedResults } from 'src/dtos/common/paged.results.dto';
import { CreateUserRequest } from 'src/dtos/user/create.user.request.dto';
import { UpdateUserPermissionsRequest } from 'src/dtos/user/update.user.permissions.request.dto';
import { UserDropdownFilter } from 'src/dtos/user/user.dropdown.filter.dto';
import { UserFilter } from 'src/dtos/user/user.filter.dto';
import { UserRequest } from 'src/dtos/user/user.request.dto';
import { UserResponse } from 'src/dtos/user/user.response.dto';
import { UserStatus } from 'src/enums';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { ShopInfo } from 'src/models/shop/shop-info.model';
import { ALL_PERMISSION_KEYS } from 'src/permissions';
import { RecentSignInResponse } from 'src/dtos/user/recent-sign-in.response.dto';
import { RoleRepository } from 'src/repositories/role.repository';
import { SettingsRepository } from 'src/repositories/settings.repository';
import { ShopRepository } from 'src/repositories/shop.repository';
import { UserAuthSessionRepository } from 'src/repositories/user-auth-session.repository';
import { UserAuthRepository } from 'src/repositories/user-auth.repository';
import { UserRepository } from 'src/repositories/user.repository';
import {
  hashPassword,
  normalizePhone,
  toPaginationInfo,
  toShopInfo,
  toUserResponse,
} from 'src/utils';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  constructor(
    private readonly userRepository: UserRepository,
    private readonly userAuthRepository: UserAuthRepository,
    private readonly shopRepository: ShopRepository,
    private readonly roleRepository: RoleRepository,
    private readonly settingsRepository: SettingsRepository,
    private readonly userAuthSessionRepository: UserAuthSessionRepository,
  ) {}

  //most recent sign-ins across the platform, for Settings > Security
  async getRecentSignIns(
    limit: number,
  ): Promise<ApiResponseDto<RecentSignInResponse[]>> {
    try {
      const sessions = await this.userAuthSessionRepository.listRecent(limit);
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
        });
      }
      return CommonResponses.OkResponse<RecentSignInResponse[]>(results);
    } catch (error) {
      this.logger.error(
        'an error occurred while getting recent sign-ins',
        error,
      );
      return CommonResponses.InternalServerErrorResponse<
        RecentSignInResponse[]
      >();
    }
  }

  async getById(id: string): Promise<ApiResponseDto<UserResponse>> {
    try {
      const user = await this.userRepository.getById(id);
      if (!user) {
        return CommonResponses.NotFoundResponse<UserResponse>();
      }
      return CommonResponses.OkResponse<UserResponse>(toUserResponse(user));
    } catch (error) {
      this.logger.error(
        'an error occurred while getting user by id',
        id,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<UserResponse>();
    }
  }

  async getByEmail(email: string): Promise<ApiResponseDto<UserResponse>> {
    try {
      const user = await this.userRepository.getByEmail(email);
      if (!user) {
        return CommonResponses.NotFoundResponse<UserResponse>();
      }
      return CommonResponses.OkResponse<UserResponse>(toUserResponse(user));
    } catch (error) {
      this.logger.error(
        'an error occurred while getting user by email',
        email,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<UserResponse>();
    }
  }

  async list(
    filter: UserFilter,
    excludeId?: string,
  ): Promise<ApiResponseDto<PagedResults<UserResponse>>> {
    try {
      const { page, pageSize } = toPaginationInfo(filter);
      const { results, totalCount } = await this.userRepository.list(
        filter,
        excludeId,
      );
      return CommonResponses.OkResponse<PagedResults<UserResponse>>({
        results: results.map((user) => toUserResponse(user)),
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        page,
        pageSize,
      });
    } catch (error) {
      this.logger.error('an error occurred while listing users', filter, error);
      return CommonResponses.InternalServerErrorResponse<
        PagedResults<UserResponse>
      >('An error occurred while listing employees');
    }
  }

  async listForDropdown(
    filter: UserDropdownFilter,
    excludeId?: string,
  ): Promise<ApiResponseDto<DropdownOption[]>> {
    try {
      const results = await this.userRepository.listForDropdown(
        filter,
        excludeId,
      );
      return CommonResponses.OkResponse<DropdownOption[]>(results);
    } catch (error) {
      this.logger.error(
        'an error occurred while listing users for dropdown',
        filter,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<DropdownOption[]>(
        'An error occurred while listing employees',
      );
    }
  }

  async create(
    request: CreateUserRequest,
  ): Promise<ApiResponseDto<UserResponse>> {
    try {
      const existing = await this.userRepository.getByEmail(request.email);
      if (existing) {
        return CommonResponses.ConflictResponse<UserResponse>(
          'An employee with this email already exists',
        );
      }

      let shopInfoSnapshot = undefined;
      if (request.shopId) {
        const shop = await this.shopRepository.getById(request.shopId);
        if (!shop) {
          return CommonResponses.NotFoundResponse<UserResponse>(
            'Shop not found',
          );
        }
        shopInfoSnapshot = toShopInfo(shop);
      }

      if (request.roleId) {
        const role = await this.roleRepository.getById(request.roleId);
        if (!role) {
          return CommonResponses.NotFoundResponse<UserResponse>(
            'Role not found',
          );
        }
      }

      // The very first user on a fresh install has nobody to grant them
      // permissions, so they bootstrap with full access - the platform
      // always needs at least one way in.
      const isFirstUser = (await this.userRepository.count()) === 0;

      const user = await this.userRepository.create({
        ...request,
        phone: normalizePhone(request.phone),
        shopInfoSnapshot,
        allPermissions: isFirstUser,
      });
      await this.userAuthRepository.create({
        userId: user.id,
        email: user.email,
        password: await hashPassword(request.password),
      });
      return CommonResponses.CreatedResponse<UserResponse>(
        toUserResponse(user),
      );
    } catch (error) {
      this.logger.error(
        'an error occurred while creating user',
        request,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<UserResponse>();
    }
  }

  async update(
    id: string,
    request: UserRequest,
  ): Promise<ApiResponseDto<UserResponse>> {
    try {
      const existing = await this.userRepository.getById(id);
      if (!existing) {
        return CommonResponses.NotFoundResponse<UserResponse>();
      }

      if (request.email && request.email !== existing.email) {
        const emailOwner = await this.userRepository.getByEmail(
          request.email,
        );
        if (emailOwner && emailOwner.id !== id) {
          return CommonResponses.ConflictResponse<UserResponse>(
            'An employee with this email already exists',
          );
        }
      }

      if (request.roleId) {
        const role = await this.roleRepository.getById(request.roleId);
        if (!role) {
          return CommonResponses.NotFoundResponse<UserResponse>(
            'Role not found',
          );
        }
      }

      // Only recompute the shop snapshot when shopId is actually part of
      // this request - omitted means "leave it as is", not "clear it".
      let shopInfoSnapshot: ShopInfo | null | undefined = undefined;
      if (request.shopId !== undefined) {
        if (request.shopId) {
          const shop = await this.shopRepository.getById(request.shopId);
          if (!shop) {
            return CommonResponses.NotFoundResponse<UserResponse>(
              'Shop not found',
            );
          }
          shopInfoSnapshot = toShopInfo(shop);
        } else {
          shopInfoSnapshot = null;
        }
      }

      const user = await this.userRepository.update(id, {
        ...request,
        phone: normalizePhone(request.phone),
        ...(shopInfoSnapshot !== undefined ? { shopInfoSnapshot } : {}),
      });
      if (!user) {
        return CommonResponses.NotFoundResponse<UserResponse>();
      }
      return CommonResponses.OkResponse<UserResponse>(toUserResponse(user));
    } catch (error) {
      this.logger.error(
        'an error occurred while updating user',
        { id, request },
        error,
      );
      return CommonResponses.InternalServerErrorResponse<UserResponse>();
    }
  }

  async updateStatus(
    id: string,
    status: UserStatus,
  ): Promise<ApiResponseDto<UserResponse>> {
    try {
      if (status !== UserStatus.Active) {
        const blocked = await this.blockedAsLastFullAccessEmployee(id);
        if (blocked) return blocked;
      }

      const user = await this.userRepository.updateStatus(id, status);
      if (!user) {
        return CommonResponses.NotFoundResponse<UserResponse>();
      }
      return CommonResponses.OkResponse<UserResponse>(toUserResponse(user));
    } catch (error) {
      this.logger.error(
        'an error occurred while updating user status',
        { id, status },
        error,
      );
      return CommonResponses.InternalServerErrorResponse<UserResponse>();
    }
  }

  async resetPassword(
    id: string,
    password: string,
  ): Promise<ApiResponseDto<UserResponse>> {
    try {
      const user = await this.userRepository.getById(id);
      if (!user) {
        return CommonResponses.NotFoundResponse<UserResponse>();
      }
      const settings = await this.settingsRepository.get();
      await this.userAuthRepository.updatePassword(
        id,
        await hashPassword(password),
        settings?.forcePasswordChangeOnReset ?? false,
      );
      return CommonResponses.OkResponse<UserResponse>(
        toUserResponse(user),
        'Password updated',
      );
    } catch (error) {
      this.logger.error(
        'an error occurred while resetting user password',
        id,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<UserResponse>();
    }
  }

  async updatePermissions(
    id: string,
    request: UpdateUserPermissionsRequest,
  ): Promise<ApiResponseDto<UserResponse>> {
    try {
      const existing = await this.userRepository.getById(id);
      if (!existing) {
        return CommonResponses.NotFoundResponse<UserResponse>();
      }

      const invalid = (request.permissionKeys ?? []).filter(
        (key) => !ALL_PERMISSION_KEYS.includes(key),
      );
      if (invalid.length > 0) {
        return CommonResponses.BadRequestResponse<UserResponse>(
          undefined,
          `Unknown permission key(s): ${invalid.join(', ')}`,
        );
      }

      if (existing.allPermissions && request.allPermissions === false) {
        const blocked = await this.blockedAsLastFullAccessEmployee(id);
        if (blocked) return blocked;
      }

      const user = await this.userRepository.updatePermissions(id, request);
      if (!user) {
        return CommonResponses.NotFoundResponse<UserResponse>();
      }
      return CommonResponses.OkResponse<UserResponse>(toUserResponse(user));
    } catch (error) {
      this.logger.error(
        'an error occurred while updating user permissions',
        { id, request },
        error,
      );
      return CommonResponses.InternalServerErrorResponse<UserResponse>();
    }
  }

  //blocks removing full access from the platform's last active
  //full-access employee, so there's always someone who can manage it
  private async blockedAsLastFullAccessEmployee(
    id: string,
  ): Promise<ApiResponseDto<UserResponse> | null> {
    const user = await this.userRepository.getById(id);
    if (!user) {
      return CommonResponses.NotFoundResponse<UserResponse>();
    }
    if (user.status !== UserStatus.Active || !user.allPermissions) {
      return null;
    }
    const activeCount = await this.userRepository.countActiveWithAllPermissions();
    if (activeCount <= 1) {
      return CommonResponses.BadRequestResponse<UserResponse>(
        undefined,
        "Cannot remove the platform's last full-access employee",
      );
    }
    return null;
  }

  async delete(id: string): Promise<ApiResponseDto<UserResponse>> {
    try {
      const blocked = await this.blockedAsLastFullAccessEmployee(id);
      if (blocked) return blocked;

      const user = await this.userRepository.delete(id);
      if (!user) {
        return CommonResponses.NotFoundResponse<UserResponse>();
      }
      return CommonResponses.OkResponse<UserResponse>(toUserResponse(user));
    } catch (error) {
      this.logger.error('an error occurred while deleting user', id, error);
      return CommonResponses.InternalServerErrorResponse<UserResponse>();
    }
  }
}
