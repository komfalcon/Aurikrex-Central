import { sql } from 'drizzle-orm';
import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

// 1. MASTER USERS TABLE
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  aurikrex_id: text('aurikrex_id').notNull().unique(),
  email: text('email').notNull().unique(),
  fullName: text('full_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().$default(() => 'student'),
  mfa_secret: text('mfa_secret'),
  mfa_enabled: integer('mfa_enabled', { mode: 'boolean' }).notNull().$default(() => false),
  profile_photo_url: text('profile_photo_url'),
  account_status: text('account_status').notNull().$default(() => 'active'),
  failed_login_attempts: integer('failed_login_attempts').notNull().$default(() => 0),
  lockout_until: integer('lockout_until', { mode: 'timestamp' }),
  last_login: integer('last_login', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$default(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$default(() => new Date()),
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email),
  aurikrexIdIdx: uniqueIndex('users_aurikrex_id_idx').on(table.aurikrex_id),
}));

// 2. OAUTH2 REGISTERED CLIENT APPS
export const ssoClients = sqliteTable('sso_clients', {
  id: text('id').primaryKey(),
  client_id: text('client_id').notNull().unique(),
  client_secret_hash: text('client_secret_hash'),
  client_name: text('client_name').notNull(),
  redirect_uris: text('redirect_uris').notNull(),
  is_trusted: integer('is_trusted', { mode: 'boolean' }).notNull().$default(() => true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$default(() => new Date()),
});

// 3. OAUTH2 AUTHORIZATION CODES
export const ssoAuthCodes = sqliteTable('sso_auth_codes', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  client_id: text('client_id').notNull(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  redirect_uri: text('redirect_uri').notNull(),
  code_challenge: text('code_challenge').notNull(),
  code_challenge_method: text('code_challenge_method').notNull().$default(() => 'S256'),
  scope: text('scope').$default(() => 'openid profile email'),
  nonce: text('nonce'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  used: integer('used', { mode: 'boolean' }).notNull().$default(() => false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$default(() => new Date()),
}, (table) => ({
  codeIdx: uniqueIndex('sso_auth_codes_code_idx').on(table.code),
}));

// 4. REFRESH TOKENS WITH FAMILY REUSE DETECTION
export const ssoRefreshTokens = sqliteTable('sso_refresh_tokens', {
  id: text('id').primaryKey(),
  family_id: text('family_id').notNull(),
  token_hash: text('token_hash').notNull().unique(),
  client_id: text('client_id').notNull(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  revoked: integer('revoked', { mode: 'boolean' }).notNull().$default(() => false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$default(() => new Date()),
}, (table) => ({
  familyIdx: index('sso_refresh_tokens_family_idx').on(table.family_id),
}));

// 5. AURI COIN WALLETS
export const auriCoinWallets = sqliteTable('auri_coin_wallets', {
  user_id: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  balance: integer('balance').notNull().$default(() => 5000),
  monthly_allowance: integer('monthly_allowance').notNull().$default(() => 5000),
  last_reset_date: integer('last_reset_date', { mode: 'timestamp' }).notNull().$default(() => new Date()),
  next_reset_date: integer('next_reset_date', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$default(() => new Date()),
});

// 6. AURI COIN AUDIT LEDGER
export const auriCoinLedger = sqliteTable('auri_coin_ledger', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  app_id: text('app_id').notNull(),
  feature_name: text('feature_name').notNull(),
  amount: integer('amount').notNull(),
  balance_after: integer('balance_after').notNull(),
  idempotency_key: text('idempotency_key').unique(),
  metadata: text('metadata'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$default(() => new Date()),
}, (table) => ({
  userIdx: index('auri_coin_ledger_user_idx').on(table.user_id),
  idempotencyIdx: uniqueIndex('auri_coin_ledger_idempotency_idx').on(table.idempotency_key),
}));

// 7. FEATURE COIN PRICING TABLE
export const featurePricing = sqliteTable('feature_pricing', {
  feature_name: text('feature_name').primaryKey(),
  cost_in_coins: integer('cost_in_coins').notNull().$default(() => 5),
  description: text('description'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$default(() => new Date()),
});

// 8. SHARED KNOWLEDGE BASE TABLE
export const sharedKnowledgeBase = sqliteTable('shared_knowledge_base', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  subject: text('subject').notNull(),
  topic: text('topic'),
  source_app: text('source_app').notNull(),
  source_id: text('source_id'),
  embedding_json: text('embedding_json'),
  is_public: integer('is_public', { mode: 'boolean' }).notNull().$default(() => true),
  author_user_id: text('author_user_id').references(() => users.id, { onDelete: 'set null' }),
  views_count: integer('views_count').notNull().$default(() => 0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$default(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$default(() => new Date()),
}, (table) => ({
  subjectIdx: index('shared_knowledge_subject_idx').on(table.subject),
  sourceAppIdx: index('shared_knowledge_source_app_idx').on(table.source_app),
}));
