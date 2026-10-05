const { createClient } = require('@libsql/client');
require('dotenv').config();

async function runMigrationAndSeed() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  console.log('Connecting to Turso Database:', url);

  const client = createClient({
    url,
    authToken,
  });

  console.log('\nCreating Database Tables...');

  // 1. Users Table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      aurikrex_id TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      mfa_secret TEXT,
      mfa_enabled INTEGER NOT NULL DEFAULT 0,
      profile_photo_url TEXT,
      account_status TEXT NOT NULL DEFAULT 'active',
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      lockout_until INTEGER,
      last_login INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `);
  await client.execute(`CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);`);
  await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS users_aurikrex_id_idx ON users(aurikrex_id);`);

  // 2. SSO Clients Table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS sso_clients (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL UNIQUE,
      client_secret_hash TEXT,
      client_name TEXT NOT NULL,
      redirect_uris TEXT NOT NULL,
      is_trusted INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `);

  // 3. SSO Auth Codes Table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS sso_auth_codes (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      client_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      redirect_uri TEXT NOT NULL,
      code_challenge TEXT NOT NULL,
      code_challenge_method TEXT NOT NULL DEFAULT 'S256',
      scope TEXT DEFAULT 'openid profile email',
      nonce TEXT,
      expires_at INTEGER NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `);
  await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS sso_auth_codes_code_idx ON sso_auth_codes(code);`);

  // 4. SSO Refresh Tokens Table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS sso_refresh_tokens (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      client_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `);
  await client.execute(`CREATE INDEX IF NOT EXISTS sso_refresh_tokens_family_idx ON sso_refresh_tokens(family_id);`);

  // 5. AuriCoin Wallets Table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS auri_coin_wallets (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      balance INTEGER NOT NULL DEFAULT 5000,
      monthly_allowance INTEGER NOT NULL DEFAULT 5000,
      last_reset_date INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      next_reset_date INTEGER NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `);

  // 6. AuriCoin Audit Ledger Table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS auri_coin_ledger (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      app_id TEXT NOT NULL,
      feature_name TEXT NOT NULL,
      amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      idempotency_key TEXT UNIQUE,
      metadata TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `);
  await client.execute(`CREATE INDEX IF NOT EXISTS auri_coin_ledger_user_idx ON auri_coin_ledger(user_id);`);

  // 7. Feature Pricing Table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS feature_pricing (
      feature_name TEXT PRIMARY KEY,
      cost_in_coins INTEGER NOT NULL DEFAULT 5,
      description TEXT,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `);

  // 8. Shared Knowledge Base Table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS shared_knowledge_base (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      subject TEXT NOT NULL,
      topic TEXT,
      source_app TEXT NOT NULL,
      source_id TEXT,
      embedding_json TEXT,
      is_public INTEGER NOT NULL DEFAULT 1,
      author_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      views_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `);
  await client.execute(`CREATE INDEX IF NOT EXISTS shared_knowledge_subject_idx ON shared_knowledge_base(subject);`);
  await client.execute(`CREATE INDEX IF NOT EXISTS shared_knowledge_source_app_idx ON shared_knowledge_base(source_app);`);

  console.log('✅ All 8 database tables created successfully on Turso Cloud!');

  console.log('\nSeeding Default Ecosystem Pricing...');

  const pricingSeeds = [
    { name: 'ai_tutor_chat', cost: 5, desc: 'AI Tutor multi-turn response' },
    { name: 'essay_grading', cost: 15, desc: 'Comprehensive essay evaluation & breakdown' },
    { name: 'flashcard_generator', cost: 10, desc: 'AI flashcard generation batch' },
    { name: 'pdf_analyzer', cost: 20, desc: 'Document indexing & vector summary' },
    { name: 'code_debugger', cost: 10, desc: 'Code optimization & bug analysis' },
  ];

  for (const seed of pricingSeeds) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO feature_pricing (feature_name, cost_in_coins, description) VALUES (?, ?, ?);`,
      args: [seed.name, seed.cost, seed.desc],
    });
  }

  console.log('Seeding Default Ecosystem SSO Clients...');
  const clientsSeeds = [
    { id: 'client_cbt', clientId: 'aurikrex_cbt_app', name: 'Aurikrex CBT Exam Platform', uris: 'https://cbt.aurikrex.com/callback,http://localhost:3000/callback' },
    { id: 'client_library', clientId: 'aurikrex_library_app', name: 'Aurikrex Digital Library', uris: 'https://library.aurikrex.com/callback,http://localhost:3001/callback' },
    { id: 'client_bytes', clientId: 'aurikrex_bytes_app', name: 'Aurikrex Bytes Social App', uris: 'https://bytes.aurikrex.com/callback,http://localhost:3002/callback' },
    { id: 'client_vault', clientId: 'aurikrex_vault_app', name: 'Aurikrex Vault/Phorynt', uris: 'https://phorynt.aurikrex.com/callback,http://localhost:3003/callback' },
  ];

  for (const clientSeed of clientsSeeds) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO sso_clients (id, client_id, client_name, redirect_uris, is_trusted) VALUES (?, ?, ?, ?, 1);`,
      args: [clientSeed.id, clientSeed.clientId, clientSeed.name, clientSeed.uris],
    });
  }

  console.log('✅ Default Ecosystem Feature Pricing and Registered OAuth2 Clients seeded!');
}

runMigrationAndSeed().catch((err) => {
  console.error('Migration/Seeding Error:', err);
  process.exit(1);
});
