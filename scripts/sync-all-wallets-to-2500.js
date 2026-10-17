const { createClient } = require('@libsql/client');
require('dotenv').config();

async function main() {
  const rawUrl = process.env.TURSO_DATABASE_URL || '';
  const url = rawUrl.replace('libsql://', 'https://');
  const c = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  console.log('Syncing all AuriCoin wallets in Turso to 2,500 coins...');

  // 1. Cap all existing balances above 2,500 to 2,500
  const balanceRes = await c.execute({
    sql: 'UPDATE auri_coin_wallets SET balance = 2500 WHERE balance > 2500',
    args: [],
  });
  console.log(`Updated balances > 2500 to 2500 (Rows affected: ${balanceRes.rowsAffected})`);

  // 2. Update all monthly allowances to 2,500
  const allowanceRes = await c.execute({
    sql: 'UPDATE auri_coin_wallets SET monthly_allowance = 2500 WHERE monthly_allowance != 2500',
    args: [],
  });
  console.log(`Updated monthly_allowance to 2500 (Rows affected: ${allowanceRes.rowsAffected})`);

  // 3. Specifically verify Edidi's wallet (lateefedidi4@gmail.com and olawaleedidi@gmail.com)
  const edidiRes = await c.execute({
    sql: `SELECT u.email, u.full_name, w.balance, w.monthly_allowance 
          FROM users u 
          JOIN auri_coin_wallets w ON u.id = w.user_id 
          WHERE u.email LIKE '%edidi%'`,
    args: [],
  });
  console.log('Edidi wallet verification:', edidiRes.rows);

  // 4. Check summary of top wallets
  const checkRes = await c.execute({
    sql: `SELECT u.email, w.balance, w.monthly_allowance 
          FROM users u 
          JOIN auri_coin_wallets w ON u.id = w.user_id 
          LIMIT 10`,
    args: [],
  });
  console.log('Sample updated wallets:', checkRes.rows);
}

main().catch(console.error);
