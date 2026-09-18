import { applyDecorators, UseGuards } from '@nestjs/common';
import { RequirePermissions } from 'src/decorators/permissions.decorator';
import { JwtAuthGuard } from 'src/providers/jwt-auth..guard';
import { PermissionsGuard } from 'src/providers/permissions.guard';

/**
 * Requires the caller to be authenticated AND hold every one of these
 * permission keys. Bundles JwtAuthGuard together with PermissionsGuard (in
 * that order, via a single UseGuards call) rather than leaving callers to
 * add JwtAuthGuard separately - a second, independent `@UseGuards(JwtAuthGuard)`
 * decorator on the same method isn't guaranteed to run before this one:
 * multiple `@UseGuards()` calls on one method compose via TypeScript's
 * bottom-up decorator application, so whichever result ends up first in the
 * merged guards array runs first - and PermissionsGuard needs
 * `request.user` (set by JwtAuthGuard) to already be there when it runs.
 */
export function AuthPermissions(...keys: string[]) {
  return applyDecorators(
    RequirePermissions(...keys),
    UseGuards(JwtAuthGuard, PermissionsGuard),
  );
}
