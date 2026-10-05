import { Injectable, Inject, ConflictException, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../db/database.module';
import { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import * as argon2 from 'argon2';
import { randomInt } from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DRIZZLE) private readonly db: LibSQLDatabase<typeof schema>,
  ) {}

  public generateAurikrexId(): string {
    const chars = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(randomInt(0, chars.length));
    }
    return `AKX-${code}`;
  }

  public async hashPassword(password: string): Promise<string> {
    return argon2.hash(password);
  }

  public async verifyPassword(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  public async createUser(data: {
    email: string;
    password: string;
    fullName: string;
    role?: string;
  }) {
    const normalizedEmail = data.email.toLowerCase().trim();
    const existing = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, normalizedEmail))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('An account with this email already exists');
    }

    const userId = uuidv4();
    const aurikrexId = this.generateAurikrexId();
    const passwordHash = await this.hashPassword(data.password);
    const now = new Date();

    await this.db.insert(schema.users).values({
      id: userId,
      aurikrex_id: aurikrexId,
      email: normalizedEmail,
      fullName: data.fullName,
      passwordHash,
      role: data.role || 'student',
      account_status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);

    // Initialize 5,000 AuriCoins Wallet
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const nextReset = new Date(now.getTime() + thirtyDaysMs);

    await this.db.insert(schema.auriCoinWallets).values({
      user_id: userId,
      balance: 5000,
      monthly_allowance: 5000,
      last_reset_date: now,
      next_reset_date: nextReset,
      updatedAt: now,
    } as any);

    await this.db.insert(schema.auriCoinLedger).values({
      id: uuidv4(),
      user_id: userId,
      app_id: 'central',
      feature_name: 'initial_monthly_allowance',
      amount: 5000,
      balance_after: 5000,
      idempotency_key: `initial_${userId}`,
      createdAt: now,
    } as any);

    return this.findById(userId);
  }

  public async findById(id: string) {
    const res = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);

    if (!res.length) throw new NotFoundException('User not found');
    const u = res[0];
    const { passwordHash, mfa_secret, ...safeUser } = u;
    return safeUser;
  }

  public async findByEmail(email: string) {
    const res = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase().trim()))
      .limit(1);
    return res[0] || null;
  }

  public async findByAurikrexId(aurikrexId: string) {
    const res = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.aurikrex_id, aurikrexId))
      .limit(1);
    if (!res.length) throw new NotFoundException('Aurikrex User not found');
    const u = res[0];
    const { passwordHash, mfa_secret, ...safeUser } = u;
    return safeUser;
  }
}
