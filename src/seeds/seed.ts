import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from 'src/modules/app.module';
import { RoleRepository } from 'src/repositories/role.repository';
import { ShopRepository } from 'src/repositories/shop.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { RoleService } from 'src/services/role.service';
import { UserService } from 'src/services/user.service';

/**
 * Dev-only seed data: a handful of representative roles and one user per
 * role, so the frontend has something real to sign in against. Never runs
 * automatically - invoke explicitly with `npm run seed`. Safe to run more
 * than once: every role/user is looked up by its unique name/email first,
 * created if missing, and its permissions re-applied either way - so this
 * also doubles as a way to re-sync a seeded user's permissions after
 * changing them here.
 *
 * A role here is just a job-title label (see the Role schema) - it carries
 * no permissions. What each user can actually do comes from the
 * permissionKeys/allPermissions set directly on them below.
 */
const SEED_PASSWORD = 'Password123!';

const ROLES = [
  {
    name: 'Super Manager',
    description: 'Full access to every feature.',
  },
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
  {
    name: 'Cashier',
    description: 'Processes sales at a shop.',
  },
];

const USERS = [
  {
    name: 'Samuel Biliksuun',
    email: 'biliksuunsamuel@gmail.com',
    phone: '+233240001001',
    roleName: 'Super Manager',
    allPermissions: true,
    permissionKeys: [] as string[],
  },
  {
    name: 'Ama Owusu',
    email: 'shop.manager@joysamfarms.test',
    phone: '+233240001002',
    roleName: 'Shop Manager',
    // Shop-based staff are tied to one shop - the frontend locks shop
    // pickers to it and scopes their data automatically. Only set for a
    // shop that already exists (shops aren't part of this seed).
    shopName: 'Adenta',
    allPermissions: false,
    permissionKeys: [
      'shop.view',
      'shop.inventory.view',
      'shop.inventory.create',
      'shop.inventory.adjust-quantity',
      'shop.inventory.update-status',
      'inventory.view',
      'stock.request.view',
      'stock.request.create',
      'expense.view',
      'expense.update',
      'expense.update-status',
      'sale.view',
      'sale.create',
    ],
  },
  {
    name: 'Kojo Mensah',
    email: 'storekeeper@joysamfarms.test',
    phone: '+233240001003',
    roleName: 'Storekeeper',
    allPermissions: false,
    permissionKeys: [
      'shop.view',
      'shop.inventory.view',
      'inventory.view',
      'inventory.create',
      'inventory.update',
      'stock.transfer.view',
      'stock.transfer.complete',
      'stock.transfer.cancel',
      'supplier.view',
      'supplier.create',
      'supplier.update',
      'supply.request.view',
      'supply.request.create',
      'supply.request.approve',
      'supply.request.reject',
      'stock.request.view',
      'stock.request.approve',
      'stock.request.reject',
    ],
  },
  {
    name: 'Efua Danso',
    email: 'accountant@joysamfarms.test',
    phone: '+233240001004',
    roleName: 'Accountant',
    shopName: 'East Legon Vet Pharmacy',
    allPermissions: false,
    permissionKeys: [
      'shop.view',
      'sale.view',
      'expense.view',
      'expense.update',
      'expense.update-status',
      'expense.delete',
      'ledger.view',
      'ledger.adjust',
      'audit.view',
    ],
  },
  {
    name: 'Yaw Boateng',
    email: 'cashier@joysamfarms.test',
    phone: '+233240001005',
    roleName: 'Cashier',
    shopName: 'Madina',
    allPermissions: false,
    permissionKeys: [
      'shop.view',
      'shop.inventory.view',
      'inventory.view',
      'sale.view',
      'sale.create',
      'stock.request.view',
      'stock.request.create',
    ],
  },
];

async function seed() {
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const roleService = app.get(RoleService);
    const roleRepository = app.get(RoleRepository);
    const shopRepository = app.get(ShopRepository);
    const userService = app.get(UserService);
    const userRepository = app.get(UserRepository);

    for (const role of ROLES) {
      const existing = await roleRepository.getByName(role.name);
      if (existing) {
        logger.log(`Role "${role.name}" already exists, skipping`);
        continue;
      }
      const res = await roleService.create(role);
      if (!res.data) {
        logger.error(`Failed to create role "${role.name}": ${res.message}`);
        continue;
      }
      logger.log(`Created role "${role.name}"`);
    }

    for (const user of USERS) {
      const role = await roleRepository.getByName(user.roleName);
      if (!role) {
        logger.error(
          `Role "${user.roleName}" not found - skipping user "${user.email}"`,
        );
        continue;
      }

      let userId = (await userRepository.getByEmail(user.email))?.id;
      if (!userId) {
        const res = await userService.create({
          name: user.name,
          email: user.email,
          phone: user.phone,
          roleId: role.id,
          password: SEED_PASSWORD,
        });
        if (!res.data) {
          logger.error(
            `Failed to create user "${user.email}": ${res.message}`,
          );
          continue;
        }
        userId = res.data.id;
        logger.log(`Created user "${user.email}" (role: ${user.roleName})`);
      } else {
        logger.log(`User "${user.email}" already exists`);
      }

      const permRes = await userService.updatePermissions(userId, {
        permissionKeys: user.permissionKeys,
        allPermissions: user.allPermissions,
      });
      if (!permRes.data) {
        logger.error(
          `Failed to set permissions for "${user.email}": ${permRes.message}`,
        );
        continue;
      }
      logger.log(`Synced permissions for "${user.email}"`);

      if (user.shopName) {
        const shop = await shopRepository.getByName(user.shopName);
        if (!shop) {
          logger.warn(
            `Shop "${user.shopName}" not found - "${user.email}" left without a shop assignment. Create the shop, then re-run the seed.`,
          );
        } else {
          const shopRes = await userService.update(userId, {
            name: user.name,
            email: user.email,
            phone: user.phone,
            roleId: role.id,
            shopId: shop.id,
          });
          if (!shopRes.data) {
            logger.error(
              `Failed to assign "${user.email}" to shop "${user.shopName}": ${shopRes.message}`,
            );
          } else {
            logger.log(`Assigned "${user.email}" to shop "${user.shopName}"`);
          }
        }
      }
    }

    logger.log('---');
    logger.log(`Seed complete. Every seeded user's password is: ${SEED_PASSWORD}`);
    logger.log('Seeded accounts:');
    for (const user of USERS) {
      logger.log(`  ${user.roleName.padEnd(14)} ${user.email}`);
    }
  } finally {
    await app.close();
  }
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
