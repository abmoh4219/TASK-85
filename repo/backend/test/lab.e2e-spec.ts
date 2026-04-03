import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';

/**
 * Lab Operations e2e tests (real PostgreSQL)
 *
 * Full lifecycle: create test dict → submit sample → enter results (abnormal flag)
 * → create report → edit report (new version) → view history → archive
 */
describe('Lab (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let employeeToken: string;

  const TEST_PREFIX = 'e2e_lab_';

  let testId: string;
  let sampleId: string;
  let reportId: string;

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
      await dataSource.query(`DELETE FROM lab_report_versions WHERE report_id IN (SELECT id FROM lab_reports WHERE created_by_id IN (SELECT id FROM users WHERE username LIKE '${TEST_PREFIX}%'))`);
      await dataSource.query(`DELETE FROM lab_reports WHERE created_by_id IN (SELECT id FROM users WHERE username LIKE '${TEST_PREFIX}%')`);
      await dataSource.query(`DELETE FROM lab_results WHERE entered_by_id IN (SELECT id FROM users WHERE username LIKE '${TEST_PREFIX}%')`);
      await dataSource.query(`DELETE FROM lab_samples WHERE submitted_by_id IN (SELECT id FROM users WHERE username LIKE '${TEST_PREFIX}%')`);
      await dataSource.query(`DELETE FROM reference_ranges WHERE test_id IN (SELECT id FROM lab_test_dictionaries WHERE test_code LIKE '${TEST_PREFIX}%')`);
      await dataSource.query(`DELETE FROM lab_test_dictionaries WHERE test_code LIKE '${TEST_PREFIX}%'`);
      await dataSource.query(`DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM users WHERE username LIKE '${TEST_PREFIX}%')`);
      await dataSource.query(`DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE username LIKE '${TEST_PREFIX}%')`);
      await dataSource.query(`DELETE FROM users WHERE username LIKE '${TEST_PREFIX}%'`);
    } catch (_) {
      // Best-effort
    }
    await app.close();
  });

  // ── Step 1: Create test dictionary entry ──────────────────────────────────

  it('Step 1: admin creates a lab test with reference ranges', async () => {
    const res = await request(app.getHttpServer())
      .post('/lab/tests')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Blood Glucose',
        testCode: `${TEST_PREFIX}GLU`,
        description: 'Fasting blood glucose',
        sampleType: 'blood',
        unit: 'mmol/L',
        referenceRanges: [
          { minValue: 3.9, maxValue: 6.1, criticalLow: 2.5, criticalHigh: 25.0 },
        ],
      })
      .expect(201);

    expect(res.body.data.testCode).toBe(`${TEST_PREFIX}GLU`);
    expect(res.body.data.referenceRanges).toHaveLength(1);
    testId = res.body.data.id;
  });

  // ── Step 2: GET /lab/tests ────────────────────────────────────────────────

  it('Step 2: GET /lab/tests returns test dictionary', async () => {
    const res = await request(app.getHttpServer())
      .get('/lab/tests')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data).toBeInstanceOf(Array);
    const found = res.body.data.find((t: { id: string }) => t.id === testId);
    expect(found).toBeDefined();
  });

  // ── Step 3: Employee submits a sample ─────────────────────────────────────

  it('Step 3: employee submits a lab sample', async () => {
    const res = await request(app.getHttpServer())
      .post('/lab/samples')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        sampleType: 'blood',
        collectionDate: new Date().toISOString(),
        patientIdentifier: 'PAT-E2E-001',
        notes: 'Fasting sample',
      })
      .expect(201);

    expect(res.body.data.status).toBe('submitted');
    expect(res.body.data.sampleNumber).toMatch(/^LAB-/);
    sampleId = res.body.data.id;
  });

  // ── Step 4: Employee sees only their own samples ───────────────────────────

  it('Step 4: employee GET /lab/samples returns only their own samples', async () => {
    const res = await request(app.getHttpServer())
      .get('/lab/samples')
      .set('Authorization', `Bearer ${employeeToken}`)
      .expect(200);

    const ids = res.body.data.map((s: { id: string }) => s.id);
    expect(ids).toContain(sampleId);
  });

  // ── Step 5: Enter result with abnormal flag auto-set ──────────────────────

  it('Step 5: admin enters result — value below min sets isAbnormal=true', async () => {
    const res = await request(app.getHttpServer())
      .post(`/lab/samples/${sampleId}/results`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        results: [
          { testId, numericValue: 2.0, notes: 'Below normal range' }, // < criticalLow 2.5
        ],
      })
      .expect(201);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].isAbnormal).toBe(true);
    expect(res.body.data[0].isCritical).toBe(true);
  });

  // ── Step 6: Sample auto-advances to in_progress ───────────────────────────

  it('Step 6: sample status is now in_progress after result entry', async () => {
    const res = await request(app.getHttpServer())
      .get(`/lab/samples/${sampleId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.status).toBe('in_progress');
    expect(res.body.data.results).toHaveLength(1);
  });

  // ── Step 7: Create report ─────────────────────────────────────────────────

  it('Step 7: admin creates a lab report — sample advances to reported', async () => {
    const res = await request(app.getHttpServer())
      .post(`/lab/samples/${sampleId}/report`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ summary: 'Critical glucose level detected — immediate attention required' })
      .expect(201);

    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.currentVersion).toBe(1);
    expect(res.body.data.versions).toHaveLength(1);
    reportId = res.body.data.id;

    // Verify sample is now reported
    const sampleRes = await request(app.getHttpServer())
      .get(`/lab/samples/${sampleId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(sampleRes.body.data.status).toBe('reported');
  });

  // ── Step 8: Edit report → new version created ────────────────────────────

  it('Step 8: admin edits report — new version created, status becomes final', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/lab/reports/${reportId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        summary: 'Critical glucose level — patient admitted for further testing',
        changeReason: 'Updated after physician review',
      })
      .expect(200);

    expect(res.body.data.status).toBe('final');
    expect(res.body.data.currentVersion).toBe(2);
    expect(res.body.data.versions).toHaveLength(2);
  });

  // ── Step 9: View version history ──────────────────────────────────────────

  it('Step 9: GET /lab/reports/:id/history returns all versions in descending order', async () => {
    const res = await request(app.getHttpServer())
      .get(`/lab/reports/${reportId}/history`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].versionNumber).toBe(2); // Most recent first
    expect(res.body.data[1].versionNumber).toBe(1);
    expect(res.body.data[0].changeReason).toBe('Updated after physician review');
  });

  // ── Step 10: Archive report ───────────────────────────────────────────────

  it('Step 10: admin archives report — sample advances to archived', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/lab/reports/${reportId}/archive`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.status).toBe('archived');

    // Verify sample is also archived
    const sampleRes = await request(app.getHttpServer())
      .get(`/lab/samples/${sampleId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(sampleRes.body.data.status).toBe('archived');
  });

  // ── Step 11: Cannot edit archived report ─────────────────────────────────

  it('Step 11: editing an archived report returns 400', async () => {
    await request(app.getHttpServer())
      .patch(`/lab/reports/${reportId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ summary: 'Attempt to edit archived report' })
      .expect(400);
  });

  // ── Step 12: Invalid status transition ────────────────────────────────────

  it('Step 12: advancing archived sample status returns 400', async () => {
    await request(app.getHttpServer())
      .patch(`/lab/samples/${sampleId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'reported' })
      .expect(400);
  });

  // ── Step 13: Normal result has isAbnormal=false ───────────────────────────

  it('Step 13: normal value does not trigger abnormal flag', async () => {
    // Create fresh sample and enter normal result
    const sampleRes = await request(app.getHttpServer())
      .post('/lab/samples')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ sampleType: 'blood', collectionDate: new Date().toISOString() });
    const normalSampleId = sampleRes.body.data.id;

    const res = await request(app.getHttpServer())
      .post(`/lab/samples/${normalSampleId}/results`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        results: [
          { testId, numericValue: 5.0 }, // within range 3.9–6.1
        ],
      })
      .expect(201);

    expect(res.body.data[0].isAbnormal).toBe(false);
    expect(res.body.data[0].isCritical).toBe(false);
  });
});
