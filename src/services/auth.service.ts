import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthResponse } from 'src/dtos/auth/auth.response.dto';
import { ChangePasswordRequest } from 'src/dtos/auth/change-password.request.dto';
import { LoginRequest } from 'src/dtos/auth/login.request.dto';
import { UserJwtDetails } from 'src/dtos/auth/user.jwt.details';
import { ApiResponseDto } from 'src/dtos/common/api.response.dto';
import { UserResponse } from 'src/dtos/user/user.response.dto';
import { UserStatus } from 'src/enums';
import { CommonResponses } from 'src/helper/common.responses.helper';
import { UserAuthSessionRepository } from 'src/repositories/user-auth-session.repository';
import { UserAuthRepository } from 'src/repositories/user-auth.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { comparePassword, hashPassword, toUserResponse } from 'src/utils';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly userRepository: UserRepository,
    private readonly userAuthRepository: UserAuthRepository,
    private readonly userAuthSessionRepository: UserAuthSessionRepository,
    private readonly jwtService: JwtService,
  ) {}

  //get user by email
  async getUserByEmail(email: string): Promise<ApiResponseDto<UserResponse>> {
    try {
      const user = await this.userRepository.getByEmail(email);
      if (!user) {
        return {
          message: 'User not found',
          code: HttpStatus.NOT_FOUND,
        };
      }
      return {
        code: HttpStatus.OK,
        data: toUserResponse(user),
      };
    } catch (error) {
      this.logger.error(
        'an error occurred during get user by email',
        error,
        email,
      );
      return {
        message: 'sorry,something went wrong',
        code: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }

  async validateUser(username: string): Promise<any> {
    return await this.userRepository.getByEmail(username);
  }

  async login(
    request: LoginRequest,
    context?: { ipAddress?: string; agent?: string },
  ): Promise<ApiResponseDto<AuthResponse>> {
    try {
      const userAuth = await this.userAuthRepository.getByEmail(request.email);
      if (!userAuth) {
        return {
          message: 'Incorrect email address or password',
          code: HttpStatus.UNAUTHORIZED,
        };
      }

      const passwordMatch = await comparePassword(
        request.password,
        userAuth.password,
      );
      if (!passwordMatch) {
        return {
          message: 'Incorrect email address or password',
          code: HttpStatus.UNAUTHORIZED,
        };
      }

      const user = await this.userRepository.getById(userAuth.userId);
      if (!user) {
        return {
          message: 'Incorrect email address or password',
          code: HttpStatus.UNAUTHORIZED,
        };
      }

      if (user.status !== UserStatus.Active) {
        return {
          message:
            user.status === UserStatus.Invited
              ? 'Your account has not been activated yet'
              : 'Your account has been disabled',
          code: HttpStatus.FORBIDDEN,
        };
      }

      const session = await this.userAuthSessionRepository.create({
        userId: user.id,
        ipAddress: context?.ipAddress,
        agent: context?.agent,
      });

      const payload: UserJwtDetails = {
        id: user.id,
        email: user.email,
        tokenId: session.tokenId,
      };
      return {
        code: HttpStatus.OK,
        data: {
          user: toUserResponse(user),
          token: await this.jwtService.signAsync(payload),
          mustChangePassword: userAuth.mustChangePassword ?? false,
        },
      };
    } catch (error) {
      this.logger.error('an error occurred during user login', error, request);
      return {
        message: 'sorry,something went wrong',
        code: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }

  //self-service password change - the only way a user with
  //mustChangePassword set can clear it themselves
  async changePassword(
    userId: string,
    request: ChangePasswordRequest,
  ): Promise<ApiResponseDto<{ success: boolean }>> {
    try {
      const userAuth = await this.userAuthRepository.getByUserId(userId);
      if (!userAuth) {
        return CommonResponses.NotFoundResponse<{ success: boolean }>(
          'Account not found',
        );
      }
      const currentMatches = await comparePassword(
        request.currentPassword,
        userAuth.password,
      );
      if (!currentMatches) {
        return CommonResponses.BadRequestResponse<{ success: boolean }>(
          undefined,
          'Current password is incorrect',
        );
      }
      await this.userAuthRepository.updatePassword(
        userId,
        await hashPassword(request.newPassword),
        false,
      );
      return CommonResponses.OkResponse<{ success: boolean }>({
        success: true,
      });
    } catch (error) {
      this.logger.error(
        'an error occurred while changing password',
        userId,
        error,
      );
      return CommonResponses.InternalServerErrorResponse<{
        success: boolean;
      }>('An error occurred while changing password');
    }
  }
}
