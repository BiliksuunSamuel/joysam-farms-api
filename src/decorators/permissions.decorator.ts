import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/** The permission keys required to reach a route - see PermissionsGuard. */
export const RequirePermissions = (...keys: string[]) =>
  SetMetadata(PERMISSIONS_KEY, keys);
