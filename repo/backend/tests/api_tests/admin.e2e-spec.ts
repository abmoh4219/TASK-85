import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import { nh } from './helpers/nonce.helper';
import { seedTestUser } from './helpers/seed-user.helper';
import { blindIndex } from '../../src/common/transformers/aes.transformer';

/**
 * Admin settings e2e tests — covers every endpoint in admin.controller.ts:
 *   GET    /admin/settings
 *   GET    /admin/settings/:key
 *   PATCH  /admin/settings/:key
 */
describe('Admin (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let employeeToken: string;

  const ADMIN_USER = 'e2e_admin_admincfg';
  const EMP_USER = 'e2e_emp_admincfg';

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

    await seedTestUser(dataSource, ADMIN_USER, 'admin', 'meridian2024');
    await seedTestUser(dataSource, EMP_USER, 'employee', 'meridian2024');

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: ADMIN_USER, password: 'meridian2024' });
    adminToken = adminLogin.body.data.accessToken;

    const empLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: EMP_USER, password: 'meridian2024' });
    employeeToken = empLogin.body.data.accessToken;
  });

  afterAll(async () => {
    try {
      const hashes = [ADMIN_USER, EMP_USER].map(u => blindIndex(u));
      await dataSource.query(
        `DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM users WHERE username_hash = ANY($1))`,
        [hashes],
      );
      await dataSource.query(
        `DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE username_hash = ANY($1))`,
        [hashes],
      );
      await dataSource.query(
        `DELETE FROM users WHERE username_hash = ANY($1)`,
        [hashes],
      );
    } catch (_) {
      // best-effort
    }
    await app.close();
  });

  // ── GET /admin/settings ─────────────────────────────────────────────────

  describe('GET /admin/settings', () => {
    it('returns all policies for admin (seeds defaults on first call)', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);
      const keys = res.body.data.map((p: { key: string }) => p.key);
      expect(keys).toEqual(expect.arrayContaining([
        'rate-limiting', 'jwt-config', 'export-permissions', 'data-security',
      ]));
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer()).get('/admin/settings').expect(401);
    });

    it('returns 403 for non-admin', async () => {
      await request(app.getHttpServer())
        .get('/admin/settings')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(403);
    });
  });

  // ── GET /admin/settings/:key ────────────────────────────────────────────

  describe('GET /admin/settings/:key', () => {
    it('returns a specific policy for admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/settings/rate-limiting')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.data.key).toBe('rate-limiting');
      expect(res.body.data.value).toBeDefined();
    });

    it('returns 404 for unknown key', async () => {
      await request(app.getHttpServer())
        .get('/admin/settings/nonexistent-key')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer())
        .get('/admin/settings/rate-limiting')
        .expect(401);
    });

    it('returns 403 for non-admin', async () => {
      await request(app.getHttpServer())
        .get('/admin/settings/rate-limiting')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(403);
    });
  });

  // ── PATCH /admin/settings/:key ──────────────────────────────────────────

  describe('PATCH /admin/settings/:key', () => {
    it('updates an existing policy as admin', async () => {
      const newValue = {
        enabled: true,
        limit: 20,
        ttlSeconds: 60,
        sensitiveEndpoints: ['login'],
      };
      const res = await request(app.getHttpServer())
        .patch('/admin/settings/rate-limiting')
        .set('Authorization', `Bearer ${adminToken}`)
        .set(nh())
        .send({ value: newValue })
        .expect(200);

      expect(res.body.data.value.limit).toBe(20);
      expect(res.body.data.updatedById).toBeDefined();
    });

    it('returns 404 when updating unknown key', async () => {
      await request(app.getHttpServer())
        .patch('/admin/settings/nope-missing')
        .set('Authorization', `Bearer ${adminToken}`)
        .set(nh())
        .send({ value: { foo: 'bar' } })
        .expect(404);
    });

    it('returns 400 for invalid payload (missing value)', async () => {
      await request(app.getHttpServer())
        .patch('/admin/settings/rate-limiting')
        .set('Authorization', `Bearer ${adminToken}`)
        .set(nh())
        .send({})
        .expect(400);
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer())
        .patch('/admin/settings/rate-limiting')
        .send({ value: { limit: 1 } })
        .expect(401);
    });

    it('returns 403 for non-admin', async () => {
      await request(app.getHttpServer())
        .patch('/admin/settings/rate-limiting')
        .set('Authorization', `Bearer ${employeeToken}`)
        .set(nh())
        .send({ value: { limit: 1 } })
        .expect(403);
    });
  });
});
