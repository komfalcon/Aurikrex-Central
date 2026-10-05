import {
  Injectable,
  Inject,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DRIZZLE } from '../db/database.module';
import { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { createHash, randomBytes, generateKeyPairSync } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  private rsaPrivateKey: string;
  private rsaPublicKey: string;
  private keyId: string = 'aurikrex-rsa-key-1';

  constructor(
    @Inject(DRIZZLE) private readonly db: LibSQLDatabase<typeof schema>,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    this.initKeys();
  }

  private initKeys() {
    const privB64 = this.configService.get<string>('RSA_PRIVATE_KEY_B64');
    const pubB64 = this.configService.get<string>('RSA_PUBLIC_KEY_B64');

    if (privB64 && pubB64) {
      this.rsaPrivateKey = Buffer.from(privB64, 'base64').toString('utf8');
      this.rsaPublicKey = Buffer.from(pubB64, 'base64').toString('utf8');
    } else {
      const { privateKey, publicKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      this.rsaPrivateKey = privateKey;
      this.rsaPublicKey = publicKey;
    }
  }

  public getJwks() {
    return {
      keys: [
        {
          kty: 'RSA',
          use: 'sig',
          alg: 'RS256',
          kid: this.keyId,
          pem: this.rsaPublicKey,
        },
      ],
    };
  }

  public async validateSsoClient(clientId: string, redirectUri?: string) {
    const clients = await this.db
      .select()
      .from(schema.ssoClients)
      .where(eq(schema.ssoClients.client_id, clientId))
      .limit(1);

    let client = clients[0];
    if (!client) {
      if (['aurikrex_cbt', 'aurikrex_library', 'aurikrex_bytes', 'aurikrex_vault'].includes(clientId)) {
        const allowedUris = [
          'https://cbt.aurikrex.com',
          'https://cbt.pxxl.click',
          'https://library.aurikrex.com',
          'https://bytes.aurikrex.com',
          'https://phorynt.aurikrex.com',
          'http://localhost:3000',
          'http://localhost:5173',
        ];
        const now = new Date();
        const newClient = {
          id: uuidv4(),
          client_id: clientId,
          client_secret_hash: null,
          client_name: clientId.replace('_', ' ').toUpperCase(),
          redirect_uris: JSON.stringify(allowedUris),
          is_trusted: true,
          createdAt: now,
        };
        await this.db.insert(schema.ssoClients).values(newClient);
        client = newClient;
      } else {
        throw new BadRequestException('Invalid OAuth2 client_id');
      }
    }

    if (redirectUri) {
      const allowed: string[] = JSON.parse(client.redirect_uris || '[]');
      const exactMatch = allowed.some(
        (uri) => uri === redirectUri || redirectUri.startsWith(uri),
      );
      if (!exactMatch) {
        throw new BadRequestException(`redirect_uri mismatch for ${clientId}`);
      }
    }

    return client;
  }

  public async generateAuthCode(params: {
    clientId: string;
    userId: string;
    redirectUri: string;
    codeChallenge: string;
    codeChallengeMethod?: string;
    scope?: string;
    nonce?: string;
  }): Promise<string> {
    const code = `ac_${randomBytes(24).toString('hex')}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

    await this.db.insert(schema.ssoAuthCodes).values({
      id: uuidv4(),
      code,
      client_id: params.clientId,
      user_id: params.userId,
      redirect_uri: params.redirectUri,
      code_challenge: params.codeChallenge,
      code_challenge_method: params.codeChallengeMethod || 'S256',
      scope: params.scope || 'openid profile email',
      nonce: params.nonce || null,
      expiresAt,
      used: false,
      createdAt: now,
    } as any);

    return code;
  }

  public async exchangeCode(params: {
    clientId: string;
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }) {
    const codes = await this.db
      .select()
      .from(schema.ssoAuthCodes)
      .where(
        and(
          eq(schema.ssoAuthCodes.code, params.code),
          eq(schema.ssoAuthCodes.client_id, params.clientId),
        ),
      )
      .limit(1);

    if (!codes.length) throw new UnauthorizedException('Invalid authorization code');
    const record = codes[0];

    if (record.used) {
      throw new UnauthorizedException('Authorization code has already been used');
    }
    if (new Date() > new Date(record.expiresAt)) {
      throw new UnauthorizedException('Authorization code expired');
    }

    if (record.code_challenge) {
      const hash = createHash('sha256').update(params.codeVerifier).digest('base64url');
      if (hash !== record.code_challenge) {
        throw new UnauthorizedException('PKCE code_verifier validation failed');
      }
    }

    await this.db
      .update(schema.ssoAuthCodes)
      .set({ used: true } as any)
      .where(eq(schema.ssoAuthCodes.id, record.id));

    const user = await this.usersService.findById(record.user_id);

    const payload = {
      sub: user.aurikrex_id,
      aurikrex_id: user.aurikrex_id,
      user_id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      aud: params.clientId,
      iss: 'https://auth.aurikrex.com',
      scope: record.scope,
      nonce: record.nonce,
    };

    const accessToken = jwt.sign(payload, this.rsaPrivateKey, {
      algorithm: 'RS256',
      expiresIn: '1h',
      keyid: this.keyId,
    });

    const familyId = uuidv4();
    const rawRefreshToken = `rt_${randomBytes(32).toString('hex')}`;
    const tokenHash = createHash('sha256').update(rawRefreshToken).digest('hex');
    const now = new Date();
    const refreshExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await this.db.insert(schema.ssoRefreshTokens).values({
      id: uuidv4(),
      family_id: familyId,
      token_hash: tokenHash,
      client_id: params.clientId,
      user_id: user.id,
      expiresAt: refreshExpiresAt,
      revoked: false,
      createdAt: now,
    } as any);

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: rawRefreshToken,
      aurikrex_id: user.aurikrex_id,
      user,
    };
  }

  public async refreshTokens(rawRefreshToken: string) {
    const tokenHash = createHash('sha256').update(rawRefreshToken).digest('hex');
    const records = await this.db
      .select()
      .from(schema.ssoRefreshTokens)
      .where(eq(schema.ssoRefreshTokens.token_hash, tokenHash))
      .limit(1);

    if (!records.length) throw new UnauthorizedException('Invalid refresh token');
    const tokenRecord = records[0];

    if (tokenRecord.revoked) {
      await this.db
        .update(schema.ssoRefreshTokens)
        .set({ revoked: true } as any)
        .where(eq(schema.ssoRefreshTokens.family_id, tokenRecord.family_id));
      throw new UnauthorizedException('Refresh token reuse detected. Session revoked.');
    }

    if (new Date() > new Date(tokenRecord.expiresAt)) {
      throw new UnauthorizedException('Refresh token expired');
    }

    await this.db
      .update(schema.ssoRefreshTokens)
      .set({ revoked: true } as any)
      .where(eq(schema.ssoRefreshTokens.id, tokenRecord.id));

    const user = await this.usersService.findById(tokenRecord.user_id);

    const payload = {
      sub: user.aurikrex_id,
      aurikrex_id: user.aurikrex_id,
      user_id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      aud: tokenRecord.client_id,
      iss: 'https://auth.aurikrex.com',
    };

    const accessToken = jwt.sign(payload, this.rsaPrivateKey, {
      algorithm: 'RS256',
      expiresIn: '1h',
      keyid: this.keyId,
    });

    const newRawRefreshToken = `rt_${randomBytes(32).toString('hex')}`;
    const newTokenHash = createHash('sha256').update(newRawRefreshToken).digest('hex');
    const now = new Date();
    const refreshExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await this.db.insert(schema.ssoRefreshTokens).values({
      id: uuidv4(),
      family_id: tokenRecord.family_id,
      token_hash: newTokenHash,
      client_id: tokenRecord.client_id,
      user_id: user.id,
      expiresAt: refreshExpiresAt,
      revoked: false,
      createdAt: now,
    } as any);

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: newRawRefreshToken,
      user,
    };
  }
}
