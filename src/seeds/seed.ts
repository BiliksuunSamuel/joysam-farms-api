import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from 'src/modules/app.module';
import { SeedService } from 'src/services/seed.service';

/**
 * Manual entry point for the same seeding SeedService already runs
 * automatically on every application boot (see its onApplicationBootstrap) -
 * useful for re-syncing locally without restarting the whole dev server.
 * Safe to run any number of times.
 */
async function run() {
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    await app.get(SeedService).seed();
    logger.log('Seed complete.');
  } finally {
    await app.close();
  }
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
