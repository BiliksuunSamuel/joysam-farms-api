import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from 'src/decorators/permissions.decorator';
import { UserRepository } from 'src/repositories/user.repository';

/**
 * Checks the current user's own permissionKeys/allPermissions for every
 * required key. Permissions live directly on the user, independent of
 * their role (a role is just a job-title label). Looked up live on each
 * request (not baked into the JWT) so that revoking a permission takes
 * effect immediately, not just on next login.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);
  constructor(
    private reflector: Reflector,
    private readonly userRepository: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const keys = this.reflector.get<string[]>(
      PERMISSIONS_KEY,
      context.getHandler(),
    );
    if (!keys || keys.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const jwtUser = request.user;
    if (!jwtUser?.id) return false;

    const user = await this.userRepository.getById(jwtUser.id);
    if (!user) return false;

    if (user.allPermissions) return true;

    const granted = keys.every((key) => user.permissionKeys.includes(key));
    this.logger.debug(
      `User ${user.id} requesting [${keys.join(', ')}]: ${granted ? 'granted' : 'denied'}`,
    );
    return granted;
  }
}
