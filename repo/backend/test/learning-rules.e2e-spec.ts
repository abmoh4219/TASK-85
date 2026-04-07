import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { nh } from './helpers/nonce.helper';

/**
 * Learning Plans & Rules Engine e2e tests (real PostgreSQL)
 *
 * Learning: plan lifecycle, goals with study frequency, session compliance
 * Rules Engine: create → activate → update → rollback → verify version restored
 */
describe('Learning & Rules Engine (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let hrToken: string;
  let employeeToken: string;

  const TEST_PREFIX = 'e2e_lr_';

  let planId: string;
  let goalId: string;
  let ruleId: string;
  let employeeUserId: string;

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

    const hash = await bcrypt.hash('testpass123', 10);
    await dataSource.query(
      `INSERT INTO users (id, username, password_hash, role, is_active, created_at, updated_at)
       VALUES
         (uuid_generate_v4(), '${TEST_PREFIX}admin',    $1, 'admin',    true, now(), now()),
         (uuid_generate_v4(), '${TEST_PREFIX}hr',       $1, 'hr',       true, now(), now()),
         (uuid_generate_v4(), '${TEST_PREFIX}employee', $1, 'employee', true, now(), now())
       ON CONFLICT (username) DO NOTHING`,
      [hash],
    );

    const [empRow] = await dataSource.query(
      `SELECT id FROM users WHERE username = '${TEST_PREFIX}employee'`,
    );
    employeeUserId = empRow.id;

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: `${TEST_PREFIX}admin`, password: 'testpass123' });
    adminToken = adminLogin.body.data.accessToken;

    const hrLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: `${TEST_PREFIX}hr`, password: 'testpass123' });
    hrToken = hrLogin.body.data.accessToken;

    const empLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: `${TEST_PREFIX}employee`, password: 'testpass123' });
    employeeToken = empLogin.body.data.accessToken;
  });

  afterAll(async () => {
    try {
      await dataSource.query(`DELETE FROM rule_rollouts WHERE rule_id IN (SELECT id FROM business_rules WHERE created_by_id IN (SELECT id FROM users WHERE username LIKE '${TEST_PREFIX}%'))`);
      await dataSource.query(`DELETE FROM rule_versions WHERE rule_id IN (SELECT id FROM business_rules WHERE created_by_id IN (SELECT id FROM users WHERE username LIKE '${TEST_PREFIX}%'))`);
      await dataSource.query(`DELETE FROM business_rules WHERE created_by_id IN (SELECT id FROM users WHERE username LIKE '${TEST_PREFIX}%')`);
      await dataSource.query(`DELETE FROM study_sessions WHERE user_id IN (SELECT id FROM users WHERE username LIKE '${TEST_PREFIX}%')`);
      await dataSource.query(`DELETE FROM learning_goals WHERE plan_id IN (SELECT id FROM learning_plans WHERE created_by_id IN (SELECT id FROM users WHERE username LIKE '${TEST_PREFIX}%'))`);
      await dataSource.query(`DELETE FROM learning_plan_lifecycle WHERE plan_id IN (SELECT id FROM learning_plans WHERE created_by_id IN (SELECT id FROM users WHERE username LIKE '${TEST_PREFIX}%'))`);
      await dataSource.query(`DELETE FROM learning_plans WHERE created_by_id IN (SELECT id FROM users WHERE username LIKE '${TEST_PREFIX}%')`);
      await dataSource.query(`DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM users WHERE username LIKE '${TEST_PREFIX}%')`);
      await dataSource.query(`DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE username LIKE '${TEST_PREFIX}%')`);
      await dataSource.query(`DELETE FROM users WHERE username LIKE '${TEST_PREFIX}%'`);
    } catch (_) {}
    await app.close();
  });

  // ── LEARNING PLANS ────────────────────────────────────────────────────────

  it('LR-1: HR creates a learning plan (status=not_started)', async () => {
    const res = await request(app.getHttpServer())
      .post('/learning/plans')
      .set('Authorization', `Bearer ${hrToken}`)
      .set(nh())
      .send({
        title: 'NestJS Mastery Plan',
        userId: employeeUserId,
        targetRole: 'senior_developer',
        startDate: new Date().toISOString(),
      })
      .expect(201);

    expect(res.body.data.status).toBe('not_started');
    planId = res.body.data.id;
  });

  it('LR-2: employee cannot create learning plans (403)', async () => {
    await request(app.getHttpServer())
      .post('/learning/plans')
      .set('Authorization', `Bearer ${employeeToken}`)
      .set(nh())
      .send({ title: 'Self-made plan', userId: employeeUserId })
      .expect(403);
  });

  it('LR-3: HR adds a goal with study frequency rule', async () => {
    const res = await request(app.getHttpServer())
      .post(`/learning/plans/${planId}/goals`)
      .set('Authorization', `Bearer ${hrToken}`)
      .set(nh())
      .send({
        title: 'Learn TypeScript decorators',
        priority: 'high',
        tags: ['typescript', 'nestjs'],
        studyFrequencyRule: '3 sessions/week',
        sessionsPerWeek: 3,
      })
      .expect(201);

    expect(res.body.data.studyFrequencyRule).toBe('3 sessions/week');
    expect(res.body.data.sessionsPerWeek).toBe(3);
    goalId = res.body.data.id;
  });

  it('LR-4: activate plan (not_started → active)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/learning/plans/${planId}/status`)
      .set('Authorization', `Bearer ${hrToken}`)
      .set(nh())
      .send({ status: 'active', reason: 'Employee is ready to start' })
      .expect(200);

    expect(res.body.data.status).toBe('active');
  });

  it('LR-5: invalid transition (active → archived) returns 400', async () => {
    await request(app.getHttpServer())
      .patch(`/learning/plans/${planId}/status`)
      .set('Authorization', `Bearer ${hrToken}`)
      .set(nh())
      .send({ status: 'archived' })
      .expect(400);
  });

  it('LR-6: employee logs a study session', async () => {
    const res = await request(app.getHttpServer())
      .post(`/learning/goals/${goalId}/sessions`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .set(nh())
      .send({ durationMinutes: 60, notes: 'Studied decorator patterns', sessionDate: new Date().toISOString() })
      .expect(201);

    expect(res.body.data.durationMinutes).toBe(60);
  });

  it('LR-7: compliance check shows sessions below target', async () => {
    // 1 session logged vs target of 3/week → below target
    const res = await request(app.getHttpServer())
      .get(`/learning/goals/${goalId}/compliance`)
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);

    expect(res.body.data.targetSessionsPerWeek).toBe(3);
    expect(res.body.data.sessionsThisWeek).toBe(1);
    expect(res.body.data.isBelowTarget).toBe(true);
    expect(res.body.data.compliancePercent).toBe(33); // 1/3 = 33%
  });

  it('LR-8: plan lifecycle history shows all transitions', async () => {
    const res = await request(app.getHttpServer())
      .get(`/learning/plans/${planId}/lifecycle`)
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(200);

    expect(res.body.data.length).toBeGreaterThanOrEqual(2); // created + activated
    const statuses = res.body.data.map((e: { toStatus: string }) => e.toStatus);
    expect(statuses).toContain('not_started');
    expect(statuses).toContain('active');
  });

  it('LR-9: pausing and resuming plan', async () => {
    await request(app.getHttpServer())
      .patch(`/learning/plans/${planId}/status`)
      .set('Authorization', `Bearer ${hrToken}`)
      .set(nh())
      .send({ status: 'paused', reason: 'On leave' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .patch(`/learning/plans/${planId}/status`)
      .set('Authorization', `Bearer ${hrToken}`)
      .set(nh())
      .send({ status: 'active', reason: 'Resumed after leave' })
      .expect(200);

    expect(res.body.data.status).toBe('active');
  });

  // ── RULES ENGINE ──────────────────────────────────────────────────────────

  it('RE-1: admin creates a business rule (status=draft, version=1)', async () => {
    const res = await request(app.getHttpServer())
      .post('/rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(nh())
      .send({
        name: `${TEST_PREFIX}Max PO Value`,
        category: 'procurement_threshold',
        definition: { threshold: 5000, currency: 'USD' },
        changeSummary: 'Initial purchase order limit',
      })
      .expect(201);

    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.currentVersion).toBe(1);
    expect(res.body.data.versions).toHaveLength(1);
    ruleId = res.body.data.id;
  });

  it('RE-2: conflict validation detects duplicate name', async () => {
    // First activate the rule so it appears as "active" in conflict check
    await request(app.getHttpServer())
      .patch(`/rules/${ruleId}/activate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(nh());

    const res = await request(app.getHttpServer())
      .post('/rules/validate')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(nh())
      .send({
        name: `${TEST_PREFIX}Max PO Value`,
        category: 'pricing',
        definition: { threshold: 9999 },
      })
      .expect(201);

    expect(res.body.data.hasConflicts).toBe(true);
  });

  it('RE-3: impact assessment lists affected workflows', async () => {
    const res = await request(app.getHttpServer())
      .get(`/rules/${ruleId}/impact`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.affectedWorkflows).toContain('Purchase Request Approval');
    expect(res.body.data.estimatedImpact).toContain('Full rollout');
  });

  it('RE-4: update rule creates version 2 and reverts to draft', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/rules/${ruleId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(nh())
      .send({
        definition: { threshold: 10000, currency: 'USD' },
        changeSummary: 'Increased PO limit to $10k',
      })
      .expect(200);

    expect(res.body.data.currentVersion).toBe(2);
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.versions).toHaveLength(2);
  });

  it('RE-5: staged rollout sets status=staged', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/rules/${ruleId}/rollout`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(nh())
      .send({ rolloutPercentage: 25 })
      .expect(200);

    expect(res.body.data.status).toBe('staged');
    expect(res.body.data.rolloutPercentage).toBe(25);
  });

  it('RE-6: activate rule (status=active, version=2)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/rules/${ruleId}/activate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(nh())
      .expect(200);

    expect(res.body.data.rule.status).toBe('active');
    expect(res.body.data.rule.currentVersion).toBe(2);
  });

  it('RE-7: rollback restores version 1, completes within 5 minutes', async () => {
    const res = await request(app.getHttpServer())
      .post(`/rules/${ruleId}/rollback`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(nh())
      .expect(201);

    expect(res.body.data.restoredVersion).toBe(1);
    expect(res.body.data.rule.currentVersion).toBe(1);
    expect(res.body.data.rule.status).toBe('active');
    expect(res.body.data.completedWithinLimit).toBe(true);
    expect(res.body.data.durationMs).toBeLessThan(5 * 60 * 1000);
  });

  it('RE-8: rollback a second time fails (no previous version)', async () => {
    await request(app.getHttpServer())
      .post(`/rules/${ruleId}/rollback`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(nh())
      .expect(400);
  });

  it('RE-9: non-admin cannot access rules (403)', async () => {
    await request(app.getHttpServer())
      .get('/rules')
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(403);
  });
});
