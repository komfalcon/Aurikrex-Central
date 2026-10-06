import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '../src/db/schema';
import { eq } from 'drizzle-orm';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';
dotenv.config();


const url = process.env.TURSO_DATABASE_URL;
const token = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error('TURSO_DATABASE_URL not set in .env');
  process.exit(1);
}

const client = createClient({ url, authToken: token });
const db = drizzle(client, { schema });

async function run() {
  const email = 'falcon@aurikrex.com';
  const plainPassword = 'KoRex1025$';
  const passwordHash = await argon2.hash(plainPassword);

  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (existing.length > 0) {
    const user = existing[0];
    await db
      .update(schema.users)
      .set({
        passwordHash,
        role: 'super_admin',
        account_status: 'active',
        updatedAt: new Date(),
      } as any)
      .where(eq(schema.users.id, user.id));

    console.log(`[Central] Updated existing admin user ${email} with role super_admin and new password.`);
  } else {
    const userId = uuidv4();
    const aurikrexId = 'AKX-FALCON1';
    const now = new Date();

    await db.insert(schema.users).values({
      id: userId,
      aurikrex_id: aurikrexId,
      email,
      fullName: 'Falcon Omotosho',
      passwordHash,
      role: 'super_admin',
      account_status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);

    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const nextReset = new Date(now.getTime() + thirtyDaysMs);

    await db.insert(schema.auriCoinWallets).values({
      user_id: userId,
      balance: 50000,
      monthly_allowance: 50000,
      last_reset_date: now,
      next_reset_date: nextReset,
      updatedAt: now,
    } as any);

    console.log(`[Central] Created new super_admin account for ${email} (${aurikrexId}).`);
  }

  process.exit(0);
}

run().catch((err) => {
  console.error('[Central] Admin seed error:', err);
  process.exit(1);
});
