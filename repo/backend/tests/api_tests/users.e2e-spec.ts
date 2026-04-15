import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import { nh } from './helpers/nonce.helper';
import { seedTestUsers } from './helpers/seed-user.helper';
import { blindIndex } from '../../src/common/transformers/aes.transformer';

describe('Users Controller (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let empToken: string;
  let hrToken: string;
  let createdUserId: string;

  const PREFIX = 'e2e_usr_';

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

    await seedTestUsers(dataSource, [
      { username: `${PREFIX}admin`, role: 'admin' },
      { username: `${PREFIX}emp`, role: 'employee' },
      { username: `${PREFIX}hr`, role: 'hr' },
    ], 'testpass123');

    const a = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: `${PREFIX}admin`, password: 'testpass123' });
    adminToken = a.body.data.accessToken;

    const e = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: `${PREFIX}emp`, password: 'testpass123' });
    empToken = e.body.data.accessToken;

    const h = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: `${PREFIX}hr`, password: 'testpass123' });
    hrToken = h.body.data.accessToken;
  });

  afterAll(async () => {
    try {
      const hashes = [
        blindIndex(`${PREFIX}admin`),
        blindIndex(`${PREFIX}emp`),
        blindIndex(`${PREFIX}hr`),
        blindIndex(`${PREFIX}new`),
      ];
      await dataSource.query(`DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE username_hash = ANY($1))`, [hashes]);
      await dataSource.query(`DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM users WHERE username_hash = ANY($1))`, [hashes]);
      await dataSource.query(`DELETE FROM users WHERE username_hash = ANY($1)`, [hashes]);
    } catch (_) {}
    await app.close();
  });

  describe('GET /admin/users', () => {
    it('admin lists users (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].passwordHash).toBeUndefined();
    });

    it('hr lists users (200)', async () => {
      await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(200);
    });

    it('no token -> 401', async () => {
      await request(app.getHttpServer()).get('/admin/users').expect(401);
    });

    it('employee -> 403', async () => {
      await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${empToken}`)
        .expect(403);
    });
  });

  describe('POST /admin/users', () => {
    it('admin creates a user (201)', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .set(nh())
        .send({ username: `${PREFIX}new`, password: 'testpass123', role: 'employee' })
        .expect(201);
      expect(res.body.data.username).toBeDefined();
      expect(res.body.data.passwordHash).toBeUndefined();
      createdUserId = res.body.data.id;
    });

    it('no token -> 401', async () => {
      await request(app.getHttpServer())
        .post('/admin/users')
        .set(nh())
        .send({ username: 'x', password: 'y', role: 'employee' })
        .expect(401);
    });

    it('hr -> 403', async () => {
      await request(app.getHttpServer())
        .post('/admin/users')
        .set('Authorization', `Bearer ${hrToken}`)
        .set(nh())
        .send({ username: 'shouldfail', password: 'pw', role: 'employee' })
        .expect(403);
    });
  });

  describe('PATCH /admin/users/:id', () => {
    it('admin updates user (200)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/admin/users/${createdUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set(nh())
        .send({ role: 'supervisor' })
        .expect(200);
      expect(res.body.data.role).toBe('supervisor');
    });

    it('no token -> 401', async () => {
      await request(app.getHttpServer())
        .patch(`/admin/users/${createdUserId}`)
        .set(nh())
        .send({ role: 'employee' })
        .expect(401);
    });

    it('employee -> 403', async () => {
      await request(app.getHttpServer())
        .patch(`/admin/users/${createdUserId}`)
        .set('Authorization', `Bearer ${empToken}`)
        .set(nh())
        .send({ role: 'employee' })
        .expect(403);
    });
  });

  describe('PATCH /admin/users/:id/deactivate', () => {
    it('admin deactivates user (200)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/admin/users/${createdUserId}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set(nh())
        .expect(200);
      expect(res.body.data.isActive).toBe(false);
    });

    it('no token -> 401', async () => {
      await request(app.getHttpServer())
        .patch(`/admin/users/${createdUserId}/deactivate`)
        .set(nh())
        .expect(401);
    });

    it('hr -> 403', async () => {
      await request(app.getHttpServer())
        .patch(`/admin/users/${createdUserId}/deactivate`)
        .set('Authorization', `Bearer ${hrToken}`)
        .set(nh())
        .expect(403);
    });
  });
});
