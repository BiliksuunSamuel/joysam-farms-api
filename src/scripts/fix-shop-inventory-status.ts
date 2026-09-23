import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

// One-time backfill for ShopInventory.status documents written before the
// Active/Inactive -> Available/Unavailable enum rename (see
// src/enums/index.ts ShopInventoryStatus). Rows created before that rename
// still carry the old string values, which no longer match any enum member,
// so they silently drop out of anything filtering on status (e.g. the
// checkout stock picker). Defaults to a dry run - pass --apply to write.
const OLD_TO_NEW: Record<string, string> = {
  Active: 'Available',
  Inactive: 'Unavailable',
};

async function run() {
  const connectionString = process.env.CONNECTION_STRING;
  if (!connectionString) {
    console.error('CONNECTION_STRING is not set.');
    process.exit(1);
  }

  const apply = process.argv.includes('--apply');

  await mongoose.connect(connectionString);
  const collection = mongoose.connection.collection('shopinventories');

  const counts = await collection
    .aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
    .toArray();
  console.log('Current status counts:', counts);

  for (const [oldStatus, newStatus] of Object.entries(OLD_TO_NEW)) {
    const matching = await collection.countDocuments({ status: oldStatus });
    if (matching === 0) continue;
    console.log(
      `${apply ? 'Updating' : '[dry run] Would update'} ${matching} doc(s): "${oldStatus}" -> "${newStatus}"`,
    );
    if (apply) {
      const result = await collection.updateMany(
        { status: oldStatus },
        { $set: { status: newStatus } },
      );
      console.log(`  matched ${result.matchedCount}, modified ${result.modifiedCount}`);
    }
  }

  if (!apply) {
    console.log('\nDry run only - no changes made. Re-run with --apply to write changes.');
  }

  await mongoose.disconnect();
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
