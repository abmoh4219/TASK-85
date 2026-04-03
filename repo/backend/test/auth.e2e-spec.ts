import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Ensure test user exists
    const hash = await bcrypt.hash('meridian2024', 10);
    await dataSource.query(
      `INSERT INTO users (id, username, password_hash, role, is_active, created_at, updated_at)
       VALUES (uuid_generate_v4(), 'e2e_admin', $1, 'admin', true, now(), now())
       ON CONFLICT (username) DO NOTHING`,
      [hash],
    );
    await dataSource.query(
      `INSERT INTO users (id, username, password_hash, role, is_active, created_at, updated_at)
       VALUES (uuid_generate_v4(), 'e2e_inactive', $1, 'employee', false, now(), now())
       ON CONFLICT (username) DO NOTHING`,
      [hash],
    );
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'e2e_%')`);
    await dataSource.query(`DELETE FROM users WHERE username LIKE 'e2e_%'`);
    await app.close();
  });

  describe('POST /auth/login', () => {
    it('returns tokens for valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'e2e_admin', password: 'meridian2024' })
        .expect(200);

      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.expiresIn).toBe(900);
    });

    it('returns 401 for wrong password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'e2e_admin', password: 'wrongpassword' })
        .expect(401);
    });

    it('returns 401 for non-existent user', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'doesnotexist', password: 'anything' })
        .expect(401);
    });

    it('returns 403 for inactive user', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'e2e_inactive', password: 'meridian2024' })
        .expect(403);
    });
  });

  describe('POST /auth/refresh', () => {
    let userId: string;
    let refreshToken: string;
    let accessToken: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'e2e_admin', password: 'meridian2024' });
      userId = res.body.data.userId;
      refreshToken = res.body.data.refreshToken;
      accessToken = res.body.data.accessToken;
    });

    it('rotates refresh token and returns new access token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ userId, refreshToken })
        .expect(200);

      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      // Old refresh token should now be invalid
      refreshToken = res.body.data.refreshToken;
    });

    it('rejects reuse of old refresh token', async () => {
      // refreshToken is already the new one; the old one was used above
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'e2e_admin', password: 'meridian2024' });
      const oldRefreshToken = res.body.data.refreshToken;

      // Use it once
      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ userId: res.body.data.userId, refreshToken: oldRefreshToken });
      expect(refreshRes.status).toBe(200);

      // Reuse should fail
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ userId: res.body.data.userId, refreshToken: oldRefreshToken })
        .expect(401);
    });

    it('returns 401 for invalid token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ userId, refreshToken: 'totally-invalid-token' })
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes refresh token and returns success', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'e2e_admin', password: 'meridian2024' });

      const { accessToken, refreshToken } = loginRes.body.data;

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ userId: loginRes.body.data.userId, refreshToken })
        .expect(200);

      // Refresh should now fail
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ userId: loginRes.body.data.userId, refreshToken })
        .expect(401);
    });
  });

  describe('GET /auth/me', () => {
    let accessToken: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'e2e_admin', password: 'meridian2024' });
      accessToken = res.body.data.accessToken;
    });

    it('returns user profile without password hash', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.username).toBe('e2e_admin');
      expect(res.body.data.role).toBe('admin');
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('returns 401 with expired/invalid token', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);
    });
  });
});
