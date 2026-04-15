import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import { nh } from './helpers/nonce.helper';
import { seedTestUser } from './helpers/seed-user.helper';
import { blindIndex, encrypt } from '../../src/common/transformers/aes.transformer';

/**
 * Notifications + Anomaly queue e2e tests — covers every endpoint in
 * notifications.controller.ts:
 *   GET   /notifications
 *   GET   /notifications/unread-count
 *   PATCH /notifications/:id/read
 *   PATCH /notifications/read-all
 *   GET   /anomalies
 *   PATCH /anomalies/:id/review
 */
describe('Notifications (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let supervisorToken: string;
  let employeeToken: string;
  let adminUserId: string;
  let employeeUserId: string;

  let notifId1: string;
  let notifId2: string;
  let anomalyId: string;

  const ADMIN_USER = 'e2e_admin_notifs';
  const SUP_USER = 'e2e_sup_notifs';
  const EMP_USER = 'e2e_emp_notifs';

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
    await seedTestUser(dataSource, SUP_USER, 'supervisor', 'meridian2024');
    await seedTestUser(dataSource, EMP_USER, 'employee', 'meridian2024');

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: ADMIN_USER, password: 'meridian2024' });
    adminToken = adminLogin.body.data.accessToken;
    adminUserId = adminLogin.body.data.userId;

    const supLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: SUP_USER, password: 'meridian2024' });
    supervisorToken = supLogin.body.data.accessToken;

    const empLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: EMP_USER, password: 'meridian2024' });
    employeeToken = empLogin.body.data.accessToken;
    employeeUserId = empLogin.body.data.userId;

    // Seed 2 notifications for the employee (so unread-count = 2)
    const [n1] = await dataSource.query(
      `INSERT INTO notifications (id, user_id, type, title, message, is_read, created_at, updated_at)
       VALUES (uuid_generate_v4(), $1, 'alert', $2, $3, false, now(), now())
       RETURNING id`,
      [employeeUserId, encrypt('Test Notification 1'), encrypt('Hello')],
    );
    notifId1 = n1.id;

    const [n2] = await dataSource.query(
      `INSERT INTO notifications (id, user_id, type, title, message, is_read, created_at, updated_at)
       VALUES (uuid_generate_v4(), $1, 'system', $2, $3, false, now(), now())
       RETURNING id`,
      [employeeUserId, encrypt('Test Notification 2'), encrypt('World')],
    );
    notifId2 = n2.id;

    // Seed a pending anomaly event
    const [a1] = await dataSource.query(
      `INSERT INTO anomaly_events (id, user_id, type, status, description, created_at, updated_at)
       VALUES (uuid_generate_v4(), $1, 'rate_limit_exceeded', 'pending', $2, now(), now())
       RETURNING id`,
      [employeeUserId, encrypt('burst detected')],
    );
    anomalyId = a1.id;
  });

  afterAll(async () => {
    try {
      const hashes = [ADMIN_USER, SUP_USER, EMP_USER].map(u => blindIndex(u));
      await dataSource.query(
        `DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE username_hash = ANY($1))`,
        [hashes],
      );
      await dataSource.query(
        `DELETE FROM anomaly_events WHERE user_id IN (SELECT id FROM users WHERE username_hash = ANY($1))`,
        [hashes],
      );
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

  // ── GET /notifications ──────────────────────────────────────────────────

  describe('GET /notifications', () => {
    it('returns notifications for current user', async () => {
      const res = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      const ids = res.body.data.map((n: { id: string }) => n.id);
      expect(ids).toEqual(expect.arrayContaining([notifId1, notifId2]));
    });

    it('returns empty array for user with no notifications', async () => {
      const res = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const ids = res.body.data.map((n: { id: string }) => n.id);
      expect(ids).not.toContain(notifId1);
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer()).get('/notifications').expect(401);
    });
  });

  // ── GET /notifications/unread-count ─────────────────────────────────────

  describe('GET /notifications/unread-count', () => {
    it('returns unread count for current user', async () => {
      const res = await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);
      expect(res.body.data.count).toBeGreaterThanOrEqual(2);
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .expect(401);
    });
  });

  // ── PATCH /notifications/:id/read ───────────────────────────────────────

  describe('PATCH /notifications/:id/read', () => {
    it('marks a single notification as read', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/notifications/${notifId1}/read`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .set(nh())
        .expect(200);
      expect(res.body.data.isRead).toBe(true);
      expect(res.body.data.readAt).toBeDefined();
    });

    it('returns 404 when notification belongs to another user', async () => {
      await request(app.getHttpServer())
        .patch(`/notifications/${notifId2}/read`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set(nh())
        .expect(404);
    });

    it('returns 404 for non-existent notification', async () => {
      await request(app.getHttpServer())
        .patch('/notifications/00000000-0000-0000-0000-000000000000/read')
        .set('Authorization', `Bearer ${employeeToken}`)
        .set(nh())
        .expect(404);
    });

    it('returns 400 for malformed UUID', async () => {
      await request(app.getHttpServer())
        .patch('/notifications/not-a-uuid/read')
        .set('Authorization', `Bearer ${employeeToken}`)
        .set(nh())
        .expect(400);
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer())
        .patch(`/notifications/${notifId2}/read`)
        .expect(401);
    });
  });

  // ── PATCH /notifications/read-all ───────────────────────────────────────

  describe('PATCH /notifications/read-all', () => {
    it('marks all notifications as read for current user', async () => {
      await request(app.getHttpServer())
        .patch('/notifications/read-all')
        .set('Authorization', `Bearer ${employeeToken}`)
        .set(nh())
        .expect(200);

      const countRes = await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .set('Authorization', `Bearer ${employeeToken}`);
      expect(countRes.body.data.count).toBe(0);
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer())
        .patch('/notifications/read-all')
        .expect(401);
    });
  });

  // ── GET /anomalies ──────────────────────────────────────────────────────

  describe('GET /anomalies', () => {
    it('returns anomalies for admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/anomalies')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      const ids = res.body.data.map((a: { id: string }) => a.id);
      expect(ids).toContain(anomalyId);
    });

    it('returns anomalies for supervisor', async () => {
      await request(app.getHttpServer())
        .get('/anomalies')
        .set('Authorization', `Bearer ${supervisorToken}`)
        .expect(200);
    });

    it('filters by status query param', async () => {
      const res = await request(app.getHttpServer())
        .get('/anomalies?status=pending')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      res.body.data.forEach((a: { status: string }) => {
        expect(a.status).toBe('pending');
      });
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer()).get('/anomalies').expect(401);
    });

    it('returns 403 for employee', async () => {
      await request(app.getHttpServer())
        .get('/anomalies')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(403);
    });
  });

  // ── PATCH /anomalies/:id/review ─────────────────────────────────────────

  describe('PATCH /anomalies/:id/review', () => {
    it('returns 403 for employee', async () => {
      await request(app.getHttpServer())
        .patch(`/anomalies/${anomalyId}/review`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .set(nh())
        .send({ notes: 'ok' })
        .expect(403);
    });

    it('returns 401 without token', async () => {
      await request(app.getHttpServer())
        .patch(`/anomalies/${anomalyId}/review`)
        .send({ notes: 'ok' })
        .expect(401);
    });

    it('returns 400 for malformed UUID', async () => {
      await request(app.getHttpServer())
        .patch('/anomalies/not-a-uuid/review')
        .set('Authorization', `Bearer ${adminToken}`)
        .set(nh())
        .send({ notes: 'ok' })
        .expect(400);
    });

    it('returns 404 for non-existent anomaly', async () => {
      await request(app.getHttpServer())
        .patch('/anomalies/00000000-0000-0000-0000-000000000000/review')
        .set('Authorization', `Bearer ${adminToken}`)
        .set(nh())
        .send({ notes: 'missing', status: 'reviewed' })
        .expect(404);
    });

    it('marks anomaly as dismissed with explicit status', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/anomalies/${anomalyId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set(nh())
        .send({ notes: 'false positive', status: 'dismissed' })
        .expect(200);
      expect(res.body.data.status).toBe('dismissed');
      expect(res.body.data.reviewedById).toBe(adminUserId);
      expect(res.body.data.reviewedAt).toBeDefined();
    });

    it('uses default status=reviewed when none supplied (no notes branch)', async () => {
      // Seed a second anomaly to hit default-status + no-notes branch
      const [a2] = await dataSource.query(
        `INSERT INTO anomaly_events (id, user_id, type, status, description, created_at, updated_at)
         VALUES (uuid_generate_v4(), $1, 'suspicious_query', 'pending', $2, now(), now())
         RETURNING id`,
        [employeeUserId, encrypt('another burst')],
      );

      const res = await request(app.getHttpServer())
        .patch(`/anomalies/${a2.id}/review`)
        .set('Authorization', `Bearer ${supervisorToken}`)
        .set(nh())
        .send({})
        .expect(200);
      expect(res.body.data.status).toBe('reviewed');
    });
  });
});
