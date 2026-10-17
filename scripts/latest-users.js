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
    sql: "SELECT id, email, full_name, created_at FROM users ORDER BY created_at DESC LIMIT 10",
    args: [],
  });
  console.log(JSON.stringify(res.rows, null, 2));
}

main().catch(console.error);
