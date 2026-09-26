import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config();

// One-time backfill for the email -> username login switch. Every existing
// User document predates the `username` field (now required + unique), so
// each one needs a generated username here before the app can require it
// for login. Existing passwords are left completely untouched - only new
// hires going forward get "password = username" (see UserService.create).
// Defaults to a dry run - pass --apply to write.

function generateUsername(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toLowerCase();
  const suffix = Math.floor(1000 + Math.random() * 9000).toString();
  return `${initials}${suffix}`;
}

async function run() {
  const connectionString = process.env.CONNECTION_STRING;
  if (!connectionString) {
    console.error('CONNECTION_STRING is not set.');
    process.exit(1);
  }

  const apply = process.argv.includes('--apply');

  await mongoose.connect(connectionString);
  const users = mongoose.connection.collection('users');
  const userAuths = mongoose.connection.collection('userauths');

  const existingUsernames = new Set(
    (await users.find({ username: { $exists: true } }).toArray()).map(
      (u) => u.username,
    ),
  );

  const missing = await users.find({ username: { $exists: false } }).toArray();
  console.log(`${missing.length} user(s) without a username.`);

  for (const user of missing) {
    let username = generateUsername(user.name ?? 'user');
    while (existingUsernames.has(username)) {
      username = generateUsername(user.name ?? 'user');
    }
    existingUsernames.add(username);

    console.log(
      `${apply ? 'Assigning' : '[dry run] Would assign'} "${username}" to ${user.name} (${user.id})`,
    );

    if (apply) {
      await users.updateOne({ id: user.id }, { $set: { username } });
      const authResult = await userAuths.updateOne(
        { userId: user.id },
        { $set: { username } },
      );
      if (authResult.matchedCount === 0) {
        console.warn(
          `  no UserAuth found for ${user.name} (${user.id}) - login credentials untouched`,
        );
      }
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
