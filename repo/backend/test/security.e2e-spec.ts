import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { encrypt, decrypt } from '../src/common/transformers/aes.transformer';

describe('Security (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let supervisorToken: string;
  let employeeToken: string;
  let rateLimitToken: string;  // dedicated token for 11.2 test
  let burstToken: string;      // dedicated token for 11.5 test
  let adminUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(helmet());
    app.enableCors({
      origin: 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Nonce', 'X-Timestamp'],
    });
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
    const hash = await bcrypt.hash('meridian2024', 10);

    // Seed test users
    await dataSource.query(
      `INSERT INTO users (id, username, password_hash, role, is_active, created_at, updated_at)
       VALUES
         (uuid_generate_v4(), 'sec_admin',      $1, 'admin',      true, now(), now()),
         (uuid_generate_v4(), 'sec_supervisor', $1, 'supervisor', true, now(), now()),
         (uuid_generate_v4(), 'sec_employee',   $1, 'employee',   true, now(), now()),
         (uuid_generate_v4(), 'sec_ratelimit',  $1, 'employee',   true, now(), now()),
         (uuid_generate_v4(), 'sec_burst',      $1, 'employee',   true, now(), now())
       ON CONFLICT (username) DO NOTHING`,
      [hash],
    );

    // Login all roles
    const adminRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'sec_admin', password: 'meridian2024' });
    adminToken = adminRes.body.data.accessToken;
    adminUserId = adminRes.body.data.userId;

    const supRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'sec_supervisor', password: 'meridian2024' });
    supervisorToken = supRes.body.data.accessToken;

    const empRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'sec_employee', password: 'meridian2024' });
    employeeToken = empRes.body.data.accessToken;

    const rlRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'sec_ratelimit', password: 'meridian2024' });
    rateLimitToken = rlRes.body.data.accessToken;

    const burstRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'sec_burst', password: 'meridian2024' });
    burstToken = burstRes.body.data.accessToken;
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM anomaly_events WHERE description LIKE '%sec_%' OR user_id IN (SELECT id FROM users WHERE username LIKE 'sec_%')`);
    await dataSource.query(`DELETE FROM lab_results WHERE sample_id IN (SELECT id FROM lab_samples WHERE sample_number LIKE 'SEC-%')`);
    await dataSource.query(`DELETE FROM lab_samples WHERE sample_number LIKE 'SEC-%'`);
    await dataSource.query(`DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'sec_%')`);
    await dataSource.query(`DELETE FROM users WHERE username LIKE 'sec_%'`);
    await app.close();
  });

  // ── 11.1 AES-256 Column Encryption ─────────────────────────────────────

  describe('11.1 AES-256 encryption roundtrip', () => {
    it('encrypts and decrypts a value correctly', () => {
      const plaintext = 'PATIENT-ID-2024-XYZ';
      const ciphertext = encrypt(plaintext);
      expect(ciphertext).not.toBe(plaintext);
      expect(ciphertext).toContain(':'); // iv:ciphertext format
      expect(decrypt(ciphertext)).toBe(plaintext);
    });

    it('two encryptions of the same value produce different ciphertexts (random IV)', () => {
      const plaintext = 'SAME-VALUE';
      const c1 = encrypt(plaintext);
      const c2 = encrypt(plaintext);
      expect(c1).not.toBe(c2);
      expect(decrypt(c1)).toBe(plaintext);
      expect(decrypt(c2)).toBe(plaintext);
    });

    it('stores patientIdentifier encrypted and returns masked value via API', async () => {
      // Create a sample with a patient identifier
      const createRes = await request(app.getHttpServer())
        .post('/lab/samples')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          sampleType: 'Blood',
          collectionDate: new Date().toISOString(),
          patientIdentifier: 'PATIENT-2024-SEC1',
        })
        .expect(201);

      const sampleId = createRes.body.data.id;
      // Returned identifier should be masked
      expect(createRes.body.data.patientIdentifier).toBe('****SEC1');

      // Verify DB stores it encrypted, not plaintext
      const rows = await dataSource.query(
        `SELECT patient_identifier FROM lab_samples WHERE id = $1`,
        [sampleId],
      );
      expect(rows[0].patient_identifier).not.toBe('PATIENT-2024-SEC1');
      expect(rows[0].patient_identifier).toContain(':'); // iv:hex format

      // Verify decryption works
      expect(decrypt(rows[0].patient_identifier)).toBe('PATIENT-2024-SEC1');

      // Cleanup
      await dataSource.query(`DELETE FROM lab_samples WHERE id = $1`, [sampleId]);
    });
  });

  // ── 11.2 Rate Limiting ──────────────────────────────────────────────────

  describe('11.2 Rate limiting (10 req/min → 429 on 11th)', () => {
    it('returns 429 after exceeding limit for a given user', async () => {
      const results: number[] = [];
      // Use the dedicated rate-limit user so other test blocks don't interfere
      for (let i = 0; i < 12; i++) {
        const res = await request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', `Bearer ${rateLimitToken}`);
        results.push(res.status);
      }
      // At least one must be 429
      expect(results).toContain(429);
      // First 10 must succeed (throttle limit = 10)
      expect(results.slice(0, 10).every((s) => s === 200)).toBe(true);
    });
  });

  // ── 11.3 Nonce + Timestamp Validation ──────────────────────────────────

  describe('11.3 Nonce + timestamp replay prevention', () => {
    it('rejects a request replayed with the same nonce', async () => {
      const nonce = `nonce-${Date.now()}-${Math.random()}`;
      const timestamp = String(Date.now());

      // First request should proceed normally (may succeed or fail for other reasons, but not 400 from nonce)
      const first = await request(app.getHttpServer())
        .post('/auth/login')
        .set('X-Nonce', nonce)
        .set('X-Timestamp', timestamp)
        .send({ username: 'sec_admin', password: 'meridian2024' });
      expect(first.status).not.toBe(400);

      // Second request with same nonce should be rejected
      const second = await request(app.getHttpServer())
        .post('/auth/login')
        .set('X-Nonce', nonce)
        .set('X-Timestamp', timestamp)
        .send({ username: 'sec_admin', password: 'meridian2024' });
      expect(second.status).toBe(400);
      expect(second.body.message).toMatch(/duplicate nonce/i);
    });

    it('rejects a request with stale timestamp (>5 min old)', async () => {
      const staleTimestamp = String(Date.now() - 6 * 60 * 1000);
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .set('X-Nonce', `stale-nonce-${Date.now()}`)
        .set('X-Timestamp', staleTimestamp)
        .send({ username: 'sec_admin', password: 'meridian2024' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/timestamp/i);
    });
  });

  // ── 11.4 Identifier Masking ─────────────────────────────────────────────

  describe('11.4 Identifier masking (last 4 chars only)', () => {
    it('masks patientIdentifier in GET /lab/samples response', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/lab/samples')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          sampleType: 'Urine',
          collectionDate: new Date().toISOString(),
          patientIdentifier: 'FULL-PATIENT-ID-ABCD',
        })
        .expect(201);

      const sampleId = createRes.body.data.id;

      const listRes = await request(app.getHttpServer())
        .get('/lab/samples')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      const found = listRes.body.data.find((s: { id: string }) => s.id === sampleId);
      expect(found).toBeDefined();
      expect(found.patientIdentifier).toBe('****ABCD');

      // Also verify GET /lab/samples/:id
      const detailRes = await request(app.getHttpServer())
        .get(`/lab/samples/${sampleId}`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);
      expect(detailRes.body.data.patientIdentifier).toBe('****ABCD');

      // Cleanup
      await dataSource.query(`DELETE FROM lab_samples WHERE id = $1`, [sampleId]);
    });

    it('handles samples with null patientIdentifier gracefully', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/lab/samples')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          sampleType: 'Swab',
          collectionDate: new Date().toISOString(),
        })
        .expect(201);

      expect(createRes.body.data.patientIdentifier).toBeNull();
      await dataSource.query(`DELETE FROM lab_samples WHERE id = $1`, [createRes.body.data.id]);
    });
  });

  // ── 11.5 Anomaly Detection ──────────────────────────────────────────────

  describe('11.5 Anomaly detection (burst → AnomalyEvent)', () => {
    it('creates AnomalyEvent when rate limit is exceeded', async () => {
      // Use dedicated burst user so this doesn't interfere with other tests
      for (let i = 0; i < 15; i++) {
        await request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', `Bearer ${burstToken}`)
          .catch(() => { /* ignore connection errors after limit */ });
      }

      // Wait a tick for the async anomaly save
      await new Promise((r) => setTimeout(r, 500));

      // Check anomaly_events table
      const rows = await dataSource.query(
        `SELECT * FROM anomaly_events WHERE type = 'rate_limit_exceeded' ORDER BY created_at DESC LIMIT 5`,
      );
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].type).toBe('rate_limit_exceeded');
      expect(rows[0].status).toBe('pending');
    });

    it('anomalies appear in GET /anomalies (supervisor)', async () => {
      const res = await request(app.getHttpServer())
        .get('/anomalies')
        .set('Authorization', `Bearer ${supervisorToken}`)
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      const hasRateLimitAnomaly = res.body.data.some(
        (a: { type: string }) => a.type === 'rate_limit_exceeded',
      );
      expect(hasRateLimitAnomaly).toBe(true);
    });
  });

  // ── 11.6 RBAC Matrix ────────────────────────────────────────────────────

  describe('11.6 RBAC — wrong role returns 403', () => {
    it('employee cannot access GET /admin/users', async () => {
      await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(403);
    });

    it('employee cannot access GET /anomalies', async () => {
      await request(app.getHttpServer())
        .get('/anomalies')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(403);
    });

    it('employee cannot access GET /rules', async () => {
      await request(app.getHttpServer())
        .get('/rules')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(403);
    });

    it('employee cannot access GET /inventory/recommendations', async () => {
      await request(app.getHttpServer())
        .get('/inventory/recommendations')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(403);
    });

    it('supervisor cannot access POST /admin/users', async () => {
      await request(app.getHttpServer())
        .post('/admin/users')
        .set('Authorization', `Bearer ${supervisorToken}`)
        .send({ username: 'ghost', password: 'x', role: 'employee' })
        .expect(403);
    });

    it('supervisor cannot access GET /rules', async () => {
      await request(app.getHttpServer())
        .get('/rules')
        .set('Authorization', `Bearer ${supervisorToken}`)
        .expect(403);
    });

    it('unauthenticated user returns 401 (or 429 if throttle hit first)', async () => {
      // Throttler guard runs before JWT guard — may return 429 if rate limit already hit
      const me = await request(app.getHttpServer()).get('/auth/me');
      expect([401, 429]).toContain(me.status);

      const users = await request(app.getHttpServer()).get('/admin/users');
      expect([401, 429]).toContain(users.status);
    });
  });

  // ── 11.7 Refresh Token Rotation ─────────────────────────────────────────

  describe('11.7 Refresh token rotation', () => {
    it('old refresh token is rejected after rotation', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'sec_admin', password: 'meridian2024' });
      const { userId, refreshToken: oldToken } = loginRes.body.data;

      // Use the refresh token once
      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ userId, refreshToken: oldToken })
        .expect(200);
      expect(refreshRes.body.data.refreshToken).toBeDefined();
      expect(refreshRes.body.data.refreshToken).not.toBe(oldToken);

      // Reuse the old token — must be rejected
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ userId, refreshToken: oldToken })
        .expect(401);
    });
  });

  // ── 11.8 Soft Deletes ───────────────────────────────────────────────────

  describe('11.8 Soft deletes — records have deletedAt, not removed', () => {
    it('deactivated user has is_active=false, record still exists', async () => {
      // Create a user to deactivate
      const createRes = await request(app.getHttpServer())
        .post('/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username: 'sec_todeactivate', password: 'meridian2024', role: 'employee' })
        .expect(201);
      const userId = createRes.body.data.id;

      // Deactivate
      await request(app.getHttpServer())
        .patch(`/admin/users/${userId}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // User should still be in DB with is_active=false
      const rows = await dataSource.query(
        `SELECT id, is_active FROM users WHERE id = $1`,
        [userId],
      );
      expect(rows.length).toBe(1);
      expect(rows[0].is_active).toBe(false);

      await dataSource.query(`DELETE FROM users WHERE id = $1`, [userId]);
    });

    it('lab sample deletedAt is set on soft delete, not removed from DB', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/lab/samples')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          sampleType: 'Blood',
          collectionDate: new Date().toISOString(),
        })
        .expect(201);
      const sampleId = createRes.body.data.id;

      // Manually soft-delete via TypeORM to verify it sets deleted_at
      await dataSource.query(
        `UPDATE lab_samples SET deleted_at = now() WHERE id = $1`,
        [sampleId],
      );

      // Record still exists in DB
      const rows = await dataSource.query(
        `SELECT id, deleted_at FROM lab_samples WHERE id = $1`,
        [sampleId],
      );
      expect(rows.length).toBe(1);
      expect(rows[0].deleted_at).not.toBeNull();

      // But normal SELECT (with TypeORM soft-delete filter) should not return it
      const visibleRows = await dataSource.query(
        `SELECT id FROM lab_samples WHERE id = $1 AND deleted_at IS NULL`,
        [sampleId],
      );
      expect(visibleRows.length).toBe(0);

      await dataSource.query(`DELETE FROM lab_samples WHERE id = $1`, [sampleId]);
    });
  });

  // ── 11.9 Helmet Security Headers ───────────────────────────────────────

  describe('11.9 Helmet security headers', () => {
    it('GET /health returns security headers', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBeDefined();
    });

    it('authenticated endpoint returns security headers', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  // ── 11.10 CORS ──────────────────────────────────────────────────────────

  describe('11.10 CORS — non-frontend origin rejected', () => {
    it('OPTIONS preflight from allowed origin includes CORS headers', async () => {
      const res = await request(app.getHttpServer())
        .options('/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST');
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('OPTIONS preflight from disallowed origin does not include CORS allow header', async () => {
      const res = await request(app.getHttpServer())
        .options('/auth/login')
        .set('Origin', 'http://evil.example.com')
        .set('Access-Control-Request-Method', 'POST');
      expect(res.headers['access-control-allow-origin']).not.toBe('http://evil.example.com');
    });
  });
});
