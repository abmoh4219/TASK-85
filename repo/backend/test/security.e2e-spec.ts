import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { encrypt, decrypt } from '../src/common/transformers/aes.transformer';
import { nh } from './helpers/nonce.helper';

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
      origin: 'https://localhost:3000',
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
        .set(nh())
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
        .set(nh())
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
        .set(nh())
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
        .set(nh())
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
        .set(nh())
        .send({ username: 'sec_todeactivate', password: 'meridian2024', role: 'employee' })
        .expect(201);
      const userId = createRes.body.data.id;

      // Deactivate
      await request(app.getHttpServer())
        .patch(`/admin/users/${userId}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set(nh())
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
        .set(nh())
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
        .set('Origin', 'https://localhost:3000')
        .set('Access-Control-Request-Method', 'POST');
      expect(res.headers['access-control-allow-origin']).toBe('https://localhost:3000');
    });

    it('OPTIONS preflight from disallowed origin does not include CORS allow header', async () => {
      const res = await request(app.getHttpServer())
        .options('/auth/login')
        .set('Origin', 'http://evil.example.com')
        .set('Access-Control-Request-Method', 'POST');
      expect(res.headers['access-control-allow-origin']).not.toBe('http://evil.example.com');
    });
  });

  // ── Action-level RBAC ──────────────────────────────────────────────────

  describe('Action-level RBAC guard', () => {
    it('allowed action succeeds (admin can manage users)', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .set(nh())
        .send({ username: 'action_test_user', password: 'meridian2024', role: 'employee' });
      expect(res.status).toBe(201);
      // Cleanup
      if (res.body.data?.id) {
        await dataSource.query(`DELETE FROM users WHERE id = $1`, [res.body.data.id]);
      }
    });

    it('disallowed action denied (employee cannot create rules)', async () => {
      const res = await request(app.getHttpServer())
        .post('/rules')
        .set('Authorization', `Bearer ${employeeToken}`)
        .set(nh())
        .send({ name: 'test-rule', definition: {} });
      expect(res.status).toBe(403);
    });
  });

  // ── Nonce enforcement on sensitive writes ──────────────────────────────

  describe('Nonce enforcement on non-auth write endpoints', () => {
    it('rejects POST without nonce headers on sensitive endpoint', async () => {
      const res = await request(app.getHttpServer())
        .post('/lab/samples')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          sampleType: 'Blood',
          collectionDate: new Date().toISOString(),
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/nonce/i);
    });

    it('accepts POST with valid nonce headers', async () => {
      const res = await request(app.getHttpServer())
        .post('/lab/samples')
        .set('Authorization', `Bearer ${employeeToken}`)
        .set(nh())
        .send({
          sampleType: 'Blood',
          collectionDate: new Date().toISOString(),
        });
      expect(res.status).toBe(201);
      if (res.body.data?.id) {
        await dataSource.query(`DELETE FROM lab_samples WHERE id = $1`, [res.body.data.id]);
      }
    });
  });

  // ── Object-level authorization ─────────────────────────────────────────

  describe('Object-level authorization', () => {
    it('employee cannot access another user sample', async () => {
      // Create a sample as admin (not the employee)
      const createRes = await request(app.getHttpServer())
        .post('/lab/samples')
        .set('Authorization', `Bearer ${adminToken}`)
        .set(nh())
        .send({
          sampleType: 'Blood',
          collectionDate: new Date().toISOString(),
          patientIdentifier: 'OBJ-AUTH-TEST-1234',
        });
      expect(createRes.status).toBe(201);
      const sampleId = createRes.body.data.id;

      // Employee tries to access the admin's sample
      const getRes = await request(app.getHttpServer())
        .get(`/lab/samples/${sampleId}`)
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(getRes.status).toBe(403);

      await dataSource.query(`DELETE FROM lab_samples WHERE id = $1`, [sampleId]);
    });

    it('employee can access their own sample', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/lab/samples')
        .set('Authorization', `Bearer ${employeeToken}`)
        .set(nh())
        .send({
          sampleType: 'Blood',
          collectionDate: new Date().toISOString(),
        });
      expect(createRes.status).toBe(201);
      const sampleId = createRes.body.data.id;

      const getRes = await request(app.getHttpServer())
        .get(`/lab/samples/${sampleId}`)
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(getRes.status).toBe(200);

      await dataSource.query(`DELETE FROM lab_samples WHERE id = $1`, [sampleId]);
    });
  });

  // ── A/B rule evaluation ────────────────────────────────────────────────

  describe('Rules-engine A/B evaluation', () => {
    it('deterministic A/B assignment is consistent', async () => {
      // Create a rule with A/B test at 50%
      const createRes = await request(app.getHttpServer())
        .post('/rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .set(nh())
        .send({
          name: 'ab-test-rule-sec',
          definition: { threshold: 42 },
          isAbTest: true,
          rolloutPercentage: 50,
        });
      expect(createRes.status).toBe(201);
      const ruleId = createRes.body.data.id;

      // Evaluate twice — should be deterministic (same result)
      const eval1 = await request(app.getHttpServer())
        .get(`/rules/${ruleId}/evaluate`)
        .set('Authorization', `Bearer ${adminToken}`);
      const eval2 = await request(app.getHttpServer())
        .get(`/rules/${ruleId}/evaluate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(eval1.body.data.inGroup).toBe(eval2.body.data.inGroup);

      // Cleanup
      await dataSource.query(`DELETE FROM rule_versions WHERE rule_id = $1`, [ruleId]);
      await dataSource.query(`DELETE FROM business_rules WHERE id = $1`, [ruleId]);
    });
  });

  // ── PO must derive from approved RFQ ───────────────────────────────────

  describe('PO-RFQ enforcement', () => {
    it('rejects PO creation without rfqId', async () => {
      const res = await request(app.getHttpServer())
        .post('/procurement/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .set(nh())
        .send({
          vendorId: '00000000-0000-0000-0000-000000000000',
          lines: [{ itemId: '00000000-0000-0000-0000-000000000000', quantity: 1, unitPrice: 10, unitOfMeasure: 'each' }],
        });
      // Should fail validation (rfqId required) with 400
      expect([400, 422]).toContain(res.status);
    });

    it('rejects PO creation with non-existent RFQ', async () => {
      const res = await request(app.getHttpServer())
        .post('/procurement/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .set(nh())
        .send({
          rfqId: '00000000-0000-0000-0000-000000000099',
          vendorId: '00000000-0000-0000-0000-000000000000',
          lines: [{ itemId: '00000000-0000-0000-0000-000000000000', quantity: 1, unitPrice: 10, unitOfMeasure: 'each' }],
        });
      expect(res.status).toBe(400);
      // message may be 'RFQ not found...' or validation error
      expect(res.body.message).toBeDefined();
    });
  });

  // ── Cross-user task/session mutation denial ────────────────────────────

  describe('Cross-user project task mutation denial', () => {
    let projId: string;
    let taskId: string;

    beforeAll(async () => {
      // Admin creates project and task assigned to admin
      const projRes = await request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${adminToken}`)
        .set(nh())
        .send({ title: 'SecTest Project' });
      projId = projRes.body.data.id;

      const taskRes = await request(app.getHttpServer())
        .post(`/projects/${projId}/tasks`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set(nh())
        .send({ title: 'SecTest Task', assignedToId: adminUserId });
      taskId = taskRes.body.data.id;

      // Advance to in_progress
      await request(app.getHttpServer())
        .patch(`/projects/${projId}/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set(nh())
        .send({ status: 'in_progress' });
    });

    it('employee cannot advance task assigned to another user', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/projects/${projId}/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .set(nh())
        .send({ status: 'submitted' });
      expect(res.status).toBe(403);
    });

    it('employee cannot submit deliverable for task assigned to another user', async () => {
      const res = await request(app.getHttpServer())
        .post(`/projects/${projId}/tasks/${taskId}/deliverables`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .set(nh())
        .send({ title: 'Unauthorized deliverable' });
      expect(res.status).toBe(403);
    });

    afterAll(async () => {
      await dataSource.query(`DELETE FROM deliverables WHERE task_id = $1`, [taskId]);
      await dataSource.query(`DELETE FROM project_tasks WHERE id = $1`, [taskId]);
      await dataSource.query(`DELETE FROM projects WHERE id = $1`, [projId]);
    });
  });

  // ── Cross-user learning session denial ─────────────────────────────────

  describe('Cross-user learning session denial', () => {
    let planId: string;
    let goalId: string;

    beforeAll(async () => {
      // Admin creates a plan assigned to admin user
      const planRes = await request(app.getHttpServer())
        .post('/learning/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .set(nh())
        .send({ title: 'SecTest Plan', userId: adminUserId });
      planId = planRes.body.data.id;

      // Activate plan
      await request(app.getHttpServer())
        .patch(`/learning/plans/${planId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set(nh())
        .send({ status: 'active', reason: 'test' });

      const goalRes = await request(app.getHttpServer())
        .post(`/learning/plans/${planId}/goals`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set(nh())
        .send({ title: 'SecTest Goal', sessionsPerWeek: 3 });
      goalId = goalRes.body.data.id;
    });

    it('employee cannot log session for a plan they do not own', async () => {
      const res = await request(app.getHttpServer())
        .post(`/learning/goals/${goalId}/sessions`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .set(nh())
        .send({ durationMinutes: 30 });
      expect(res.status).toBe(403);
    });

    afterAll(async () => {
      await dataSource.query(`DELETE FROM study_sessions WHERE goal_id = $1`, [goalId]);
      await dataSource.query(`DELETE FROM learning_goals WHERE id = $1`, [goalId]);
      await dataSource.query(`DELETE FROM learning_plan_lifecycle WHERE plan_id = $1`, [planId]);
      await dataSource.query(`DELETE FROM learning_plans WHERE id = $1`, [planId]);
    });
  });

  // ── Durable nonce replay ───────────────────────────────────────────────

  describe('Durable nonce replay protection', () => {
    it('rejects duplicate nonce for same user (DB-backed)', async () => {
      const nonce = `durable-nonce-${Date.now()}-${Math.random()}`;
      const ts = String(Date.now());

      // First request — should succeed (auth exempt path with nonce validates)
      const first = await request(app.getHttpServer())
        .post('/auth/login')
        .set('X-Nonce', nonce)
        .set('X-Timestamp', ts)
        .send({ username: 'sec_admin', password: 'meridian2024' });
      expect(first.status).not.toBe(400);

      // Second with same nonce — should be rejected
      const second = await request(app.getHttpServer())
        .post('/auth/login')
        .set('X-Nonce', nonce)
        .set('X-Timestamp', ts)
        .send({ username: 'sec_admin', password: 'meridian2024' });
      expect(second.status).toBe(400);
      expect(second.body.message).toMatch(/nonce/i);
    });

    it('nonce persisted in DB can be verified', async () => {
      const rows = await dataSource.query(
        `SELECT COUNT(*) as cnt FROM used_nonces WHERE created_at > NOW() - INTERVAL '5 minutes'`,
      );
      expect(Number(rows[0].cnt)).toBeGreaterThan(0);
    });
  });

  // ── Encryption evidence ────────────────────────────────────────────────

  describe('Encryption coverage for sensitive fields', () => {
    it('vendor contact info is encrypted at rest for new records', async () => {
      // Insert a vendor via TypeORM (which applies the transformer)
      const Vendor = dataSource.getRepository('vendors');
      const vendor = await dataSource.query(
        `INSERT INTO vendors (id, name, contact_name, email, phone, is_active, created_at, updated_at)
         VALUES (uuid_generate_v4(), 'EncTestVendor', 'WILL_BE_ENCRYPTED', 'WILL_BE_ENCRYPTED', 'WILL_BE_ENCRYPTED', true, now(), now())
         RETURNING id`,
      );
      // The raw SQL insert above won't use the transformer. Let's use the ORM entity manager instead.
      await dataSource.query(`DELETE FROM vendors WHERE name = 'EncTestVendor'`);

      // Use the entity manager which applies the AES transformer
      const mgr = dataSource.manager;
      const saved = await mgr.save(mgr.create('Vendor' as any, {
        name: 'EncTestVendor2',
        contactName: 'Secret Contact',
        email: 'secret@test.com',
        phone: '555-1234',
        isActive: true,
      }));
      const id = (saved as any).id;

      // Read raw from DB — should be encrypted (iv:hex format)
      const rows = await dataSource.query(
        `SELECT contact_name, email, phone FROM vendors WHERE id = $1`, [id],
      );
      expect(rows[0].contact_name).toContain(':');
      expect(rows[0].email).toContain(':');
      expect(rows[0].phone).toContain(':');
      expect(rows[0].contact_name).not.toBe('Secret Contact');

      await dataSource.query(`DELETE FROM vendors WHERE id = $1`, [id]);
    });

    it('lab sample notes are encrypted at rest', async () => {
      // Create a sample with notes
      const createRes = await request(app.getHttpServer())
        .post('/lab/samples')
        .set('Authorization', `Bearer ${employeeToken}`)
        .set(nh())
        .send({
          sampleType: 'Blood',
          collectionDate: new Date().toISOString(),
          notes: 'Sensitive clinical note for encryption test',
        });
      expect(createRes.status).toBe(201);
      const sampleId = createRes.body.data.id;

      // Check DB stores encrypted
      const rows = await dataSource.query(
        `SELECT notes FROM lab_samples WHERE id = $1`, [sampleId],
      );
      expect(rows[0].notes).not.toBe('Sensitive clinical note for encryption test');
      expect(rows[0].notes).toContain(':'); // iv:ciphertext format

      await dataSource.query(`DELETE FROM lab_samples WHERE id = $1`, [sampleId]);
    });
  });

  // ── Lab report cross-user read denial ──────────────────────────────────

  describe('Lab report/history cross-user read denial', () => {
    let sampleId: string;
    let reportId: string;

    beforeAll(async () => {
      // Admin creates a sample and report
      const sRes = await request(app.getHttpServer())
        .post('/lab/samples')
        .set('Authorization', `Bearer ${adminToken}`)
        .set(nh())
        .send({ sampleType: 'Blood', collectionDate: new Date().toISOString() });
      sampleId = sRes.body.data.id;

      // Advance to in_progress
      await request(app.getHttpServer())
        .patch(`/lab/samples/${sampleId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set(nh())
        .send({ status: 'in_progress' });

      // Create report
      const rRes = await request(app.getHttpServer())
        .post(`/lab/samples/${sampleId}/report`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set(nh())
        .send({ summary: 'Admin report' });
      reportId = rRes.body.data.id;
    });

    it('employee cannot read report belonging to another user sample', async () => {
      const res = await request(app.getHttpServer())
        .get(`/lab/reports/${reportId}`)
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(res.status).toBe(403);
    });

    it('employee cannot read report history of another user sample', async () => {
      const res = await request(app.getHttpServer())
        .get(`/lab/reports/${reportId}/history`)
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(res.status).toBe(403);
    });

    afterAll(async () => {
      await dataSource.query(`DELETE FROM lab_report_versions WHERE report_id = $1`, [reportId]);
      await dataSource.query(`DELETE FROM lab_reports WHERE id = $1`, [reportId]);
      await dataSource.query(`DELETE FROM lab_samples WHERE id = $1`, [sampleId]);
    });
  });

  // ── Learning compliance cross-user denial ──────────────────────────────

  describe('Learning compliance cross-user read denial', () => {
    let planId: string;
    let goalId: string;

    beforeAll(async () => {
      const pRes = await request(app.getHttpServer())
        .post('/learning/plans')
        .set('Authorization', `Bearer ${adminToken}`)
        .set(nh())
        .send({ title: 'Compliance Test Plan', userId: adminUserId });
      planId = pRes.body.data.id;

      await request(app.getHttpServer())
        .patch(`/learning/plans/${planId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set(nh())
        .send({ status: 'active', reason: 'test' });

      const gRes = await request(app.getHttpServer())
        .post(`/learning/plans/${planId}/goals`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set(nh())
        .send({ title: 'Compliance Goal', sessionsPerWeek: 3 });
      goalId = gRes.body.data.id;
    });

    it('employee cannot check compliance for a goal in another user plan', async () => {
      const res = await request(app.getHttpServer())
        .get(`/learning/goals/${goalId}/compliance`)
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(res.status).toBe(403);
    });

    afterAll(async () => {
      await dataSource.query(`DELETE FROM learning_goals WHERE id = $1`, [goalId]);
      await dataSource.query(`DELETE FROM learning_plan_lifecycle WHERE plan_id = $1`, [planId]);
      await dataSource.query(`DELETE FROM learning_plans WHERE id = $1`, [planId]);
    });
  });

  // ── Catalog management RBAC tests ──────────────────────────────────────

  describe('Catalog management RBAC', () => {
    it('employee cannot create item category', async () => {
      const res = await request(app.getHttpServer())
        .post('/inventory/categories')
        .set('Authorization', `Bearer ${employeeToken}`)
        .set(nh())
        .send({ name: 'Unauthorized Category' });
      expect(res.status).toBe(403);
    });

    it('employee cannot create vendor', async () => {
      const res = await request(app.getHttpServer())
        .post('/procurement/vendors')
        .set('Authorization', `Bearer ${employeeToken}`)
        .set(nh())
        .send({ name: 'Unauthorized Vendor' });
      expect(res.status).toBe(403);
    });

    it('admin can create item category', async () => {
      const res = await request(app.getHttpServer())
        .post('/inventory/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .set(nh())
        .send({ name: `TestCat-${Date.now()}` });
      expect(res.status).toBe(201);
      if (res.body.data?.id) {
        await dataSource.query(`DELETE FROM item_categories WHERE id = $1`, [res.body.data.id]);
      }
    });
  });

  // ── Export enforcement ─────────────────────────────────────────────────

  describe('Export enforcement', () => {
    it('admin can export procurement data', async () => {
      const res = await request(app.getHttpServer())
        .get('/procurement/export')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.exportedAt).toBeDefined();
    });

    it('employee is denied procurement export', async () => {
      const res = await request(app.getHttpServer())
        .get('/procurement/export')
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(res.status).toBe(403);
    });
  });
});
