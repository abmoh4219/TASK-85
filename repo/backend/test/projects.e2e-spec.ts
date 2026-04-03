import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';

/**
 * Projects & Work Tracking e2e tests (real PostgreSQL)
 *
 * Full lifecycle: create project → add milestone → add task (employee) →
 * advance task → submit deliverable → supervisor approval →
 * acceptance scoring → project status progression through all 5 stages.
 */
describe('Projects (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let employeeToken: string;

  const TEST_PREFIX = 'e2e_proj_';

  let projectId: string;
  let taskId: string;
  let milestoneId: string;
  let deliverableId: string;

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
         (uuid_generate_v4(), '${TEST_PREFIX}employee', $1, 'employee', true, now(), now())
       ON CONFLICT (username) DO NOTHING`,
      [hash],
    );

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: `${TEST_PREFIX}admin`, password: 'testpass123' });
    adminToken = adminLogin.body.data.accessToken;

    const empLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: `${TEST_PREFIX}employee`, password: 'testpass123' });
    employeeToken = empLogin.body.data.accessToken;
  });

  afterAll(async () => {
    try {
      await dataSource.query(`DELETE FROM acceptance_scores WHERE project_id IN (SELECT id FROM projects WHERE owner_id IN (SELECT id FROM users WHERE username LIKE '${TEST_PREFIX}%'))`);
      await dataSource.query(`DELETE FROM deliverables WHERE submitted_by_id IN (SELECT id FROM users WHERE username LIKE '${TEST_PREFIX}%')`);
      await dataSource.query(`DELETE FROM project_tasks WHERE created_by_id IN (SELECT id FROM users WHERE username LIKE '${TEST_PREFIX}%')`);
      await dataSource.query(`DELETE FROM milestones WHERE project_id IN (SELECT id FROM projects WHERE owner_id IN (SELECT id FROM users WHERE username LIKE '${TEST_PREFIX}%'))`);
      await dataSource.query(`DELETE FROM projects WHERE owner_id IN (SELECT id FROM users WHERE username LIKE '${TEST_PREFIX}%')`);
      await dataSource.query(`DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM users WHERE username LIKE '${TEST_PREFIX}%')`);
      await dataSource.query(`DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE username LIKE '${TEST_PREFIX}%')`);
      await dataSource.query(`DELETE FROM users WHERE username LIKE '${TEST_PREFIX}%'`);
    } catch (_) {
      // Best-effort
    }
    await app.close();
  });

  // ── Step 1: Create project ────────────────────────────────────────────────

  it('Step 1: admin creates a project (status=initiation)', async () => {
    const res = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'E2E Test Project',
        description: 'Full lifecycle test project',
        startDate: new Date().toISOString(),
      })
      .expect(201);

    expect(res.body.data.status).toBe('initiation');
    projectId = res.body.data.id;
  });

  // ── Step 2: Add milestone ─────────────────────────────────────────────────

  it('Step 2: admin adds a milestone', async () => {
    const res = await request(app.getHttpServer())
      .post(`/projects/${projectId}/milestones`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Phase 1 Complete',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .expect(201);

    expect(res.body.data.progressPercent).toBe(0);
    milestoneId = res.body.data.id;
  });

  // ── Step 3: Update milestone progress ────────────────────────────────────

  it('Step 3: admin updates milestone progress to 50%', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/projects/${projectId}/milestones/${milestoneId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ progressPercent: 50 })
      .expect(200);

    expect(res.body.data.progressPercent).toBe(50);
    expect(res.body.data.completedAt).toBeNull();
  });

  it('Step 3b: setting progress to 100% marks completedAt', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/projects/${projectId}/milestones/${milestoneId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ progressPercent: 100 })
      .expect(200);

    expect(res.body.data.progressPercent).toBe(100);
    expect(res.body.data.completedAt).not.toBeNull();
  });

  // ── Step 4: Employee creates a task ──────────────────────────────────────

  it('Step 4: employee creates a task', async () => {
    const res = await request(app.getHttpServer())
      .post(`/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: 'Write unit tests',
        description: 'Write comprehensive unit tests for module X',
      })
      .expect(201);

    expect(res.body.data.status).toBe('pending');
    taskId = res.body.data.id;
  });

  // ── Step 5: Advance task through status flow ──────────────────────────────

  it('Step 5: advance task pending → in_progress', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/projects/${projectId}/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ status: 'in_progress' })
      .expect(200);

    expect(res.body.data.status).toBe('in_progress');
  });

  it('Step 5b: invalid transition (in_progress → approved) returns 400', async () => {
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' })
      .expect(400);
  });

  // ── Step 6: Submit deliverable → task auto-advances to submitted ──────────

  it('Step 6: employee submits a deliverable — task advances to submitted', async () => {
    const res = await request(app.getHttpServer())
      .post(`/projects/${projectId}/tasks/${taskId}/deliverables`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        title: 'unit-tests-v1.zip',
        description: 'First version of unit tests',
        fileUrl: 'https://files.example.com/unit-tests-v1.zip',
      })
      .expect(201);

    deliverableId = res.body.data.id;

    // Task should be auto-advanced to submitted
    const taskRes = await request(app.getHttpServer())
      .get(`/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${adminToken}`);
    const task = taskRes.body.data.find((t: { id: string }) => t.id === taskId);
    expect(task.status).toBe('submitted');
  });

  // ── Step 7: Supervisor approves task ─────────────────────────────────────

  it('Step 7: admin approves the task', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/projects/${projectId}/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' })
      .expect(200);

    expect(res.body.data.status).toBe('approved');
  });

  it('Step 7b: employee cannot approve tasks (403)', async () => {
    // Create a fresh task to test RBAC
    const createRes = await request(app.getHttpServer())
      .post(`/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ title: 'RBAC test task' });
    const newTaskId = createRes.body.data.id;

    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/tasks/${newTaskId}/status`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({ status: 'approved' })
      .expect(403);
  });

  // ── Step 8: Acceptance scoring ────────────────────────────────────────────

  it('Step 8: admin scores acceptance for a deliverable', async () => {
    const res = await request(app.getHttpServer())
      .post(`/projects/${projectId}/acceptance-score`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        score: 87,
        maxScore: 100,
        deliverableId,
        feedback: 'Good work, minor improvements needed',
      })
      .expect(201);

    expect(Number(res.body.data.score)).toBe(87);
    expect(Number(res.body.data.maxScore)).toBe(100);
  });

  // ── Step 9: Project status progression ───────────────────────────────────

  it('Step 9a: advance project initiation → change', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/projects/${projectId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'change' })
      .expect(200);
    expect(res.body.data.status).toBe('change');
  });

  it('Step 9b: advance project change → inspection', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/projects/${projectId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'inspection' })
      .expect(200);
    expect(res.body.data.status).toBe('inspection');
  });

  it('Step 9c: invalid transition inspection → change returns 400', async () => {
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'change' })
      .expect(400);
  });

  it('Step 9d: advance project inspection → final_acceptance', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/projects/${projectId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'final_acceptance' })
      .expect(200);
    expect(res.body.data.status).toBe('final_acceptance');
  });

  it('Step 9e: advance project final_acceptance → archive', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/projects/${projectId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'archive' })
      .expect(200);
    expect(res.body.data.status).toBe('archive');
  });

  it('Step 9f: archived project cannot advance further (400)', async () => {
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'initiation' })
      .expect(400);
  });

  // ── Step 10: Get project detail ───────────────────────────────────────────

  it('Step 10: GET /projects/:id returns project with tasks and milestones', async () => {
    const res = await request(app.getHttpServer())
      .get(`/projects/${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.id).toBe(projectId);
    expect(res.body.data.tasks).toBeInstanceOf(Array);
    expect(res.body.data.milestones).toBeInstanceOf(Array);
    expect(res.body.data.milestones[0].progressPercent).toBe(100);
  });
});
