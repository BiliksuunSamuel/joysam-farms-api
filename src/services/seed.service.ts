import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { RoleRepository } from 'src/repositories/role.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { RoleService } from 'src/services/role.service';
import { UserService } from 'src/services/user.service';

// Standard job-title templates every deployment needs available on the
// Employees page to assign to real staff - not accounts, just labels (see
// the Role schema: a role carries no permissions of its own).
const ROLE_TEMPLATES = [
  { name: 'Manager', description: 'Full access to every feature.' },
  {
    name: 'Shop Manager',
    description: "Runs a shop's inventory and expenses.",
  },
  {
    name: 'Storekeeper',
    description: 'Manages warehouse stock and fulfils shop requests.',
  },
  {
    name: 'Accountant',
    description: 'Expenses, the ledger, and audit history.',
  },
  { name: 'Cashier', description: 'Processes sales at a shop.' },
];

// The two real owner/manager accounts every deployment should have. The
// password for each is read from its own env var at creation time only -
// never hardcoded, since (unlike the old dummy test accounts) these are
// real credentials. If the env var is missing when the account doesn't yet
// exist, that one account is skipped (logged, not thrown) rather than
// blocking the rest of boot.
type OwnerAccount = {
  name: string;
  email: string;
  phone: string;
  passwordEnvVar: string;
};
const OWNER_ACCOUNTS: OwnerAccount[] = [
  {
    name: 'Samuel Biliksuun',
    email: 'biliksuunsamuel@gmail.com',
    phone: '233550465223',
    passwordEnvVar: 'MANAGER_1_PASSWORD',
  },
  {
    // Lowercase - the client always lowercases the email before signing in
    // (case-insensitive login UX), and the server looks users up by an
    // exact match, so the stored email must already be lowercase or sign-in
    // permanently fails for any account whose email wasn't typed all-lower.
    name: 'Joy Sams',
    email: 'joysamfarms23@gmail.com',
    phone: '233546592403',
    passwordEnvVar: 'MANAGER_2_PASSWORD',
  },
];

/**
 * Ensures the standard role templates and the two owner accounts exist -
 * runs automatically on every application boot (see onApplicationBootstrap
 * below), not just via the manual `npm run seed` CLI script (src/seeds/seed.ts,
 * a thin wrapper around this same service). Purely additive: creates a role/
 * account only if missing by name/email, and re-syncs the owner accounts'
 * permissions to allPermissions on every run so they can never accidentally
 * get locked out - but it never touches, resyncs, or deletes any OTHER user
 * (e.g. real or test employee accounts created since), only these two.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly roleService: RoleService,
    private readonly roleRepository: RoleRepository,
    private readonly userService: UserService,
    private readonly userRepository: UserRepository,
  ) {}

  // Never throws - a seeding hiccup (e.g. a missing password env var, or a
  // transient DB error on a redeploy) must never take the whole API down.
  async onApplicationBootstrap() {
    try {
      await this.seed();
    } catch (error) {
      this.logger.error('an error occurred while seeding', error);
    }
  }

  async seed() {
    // One-time migration: the role used to be named "Super Manager" -
    // rename that exact document in place (same id, so every user already
    // pointing at it via roleId keeps working with zero changes) rather
    // than leaving the old name around or creating a duplicate "Manager".
    const legacyRole = await this.roleRepository.getByName('Super Manager');
    if (legacyRole && legacyRole.name !== 'Manager') {
      await this.roleRepository.update(legacyRole.id, {
        name: 'Manager',
        description: legacyRole.description,
      });
      this.logger.log('Renamed role "Super Manager" to "Manager"');
    }

    for (const role of ROLE_TEMPLATES) {
      const existing = await this.roleRepository.getByName(role.name);
      if (existing) continue;
      const res = await this.roleService.create(role);
      if (res.data) this.logger.log(`Created role "${role.name}"`);
    }

    const managerRole = await this.roleRepository.getByName('Manager');
    if (!managerRole) {
      this.logger.error('Role "Manager" not found - skipping owner accounts');
      return;
    }

    for (const account of OWNER_ACCOUNTS) {
      let userId = (await this.userRepository.getByEmail(account.email))?.id;
      if (!userId) {
        const password = process.env[account.passwordEnvVar];
        if (!password) {
          this.logger.warn(
            `${account.passwordEnvVar} is not set - skipping account "${account.email}"`,
          );
          continue;
        }
        const res = await this.userService.create({
          name: account.name,
          email: account.email,
          phone: account.phone,
          roleId: managerRole.id,
          password,
        });
        if (!res.data) {
          this.logger.error(
            `Failed to create "${account.email}": ${res.message}`,
          );
          continue;
        }
        userId = res.data.id;
        this.logger.log(`Created owner account "${account.email}"`);
      }

      await this.userService.updatePermissions(userId, {
        permissionKeys: [],
        allPermissions: true,
      });
    }
  }
}
