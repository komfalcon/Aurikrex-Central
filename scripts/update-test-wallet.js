const { createClient } = require('@libsql/client');
require('dotenv').config();

async function main() {
  const rawUrl = process.env.TURSO_DATABASE_URL || '';
  const url = rawUrl.replace('libsql://', 'https://');
  const c = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const res = await c.execute({
    sql: "UPDATE auri_coin_wallets SET balance = 2500, monthly_allowance = 2500 WHERE user_id = (SELECT id FROM users WHERE email = 'test@example.com')",
    args: [],
  });
  console.log('Rows affected:', res.rowsAffected);
}

main().catch(console.error);
