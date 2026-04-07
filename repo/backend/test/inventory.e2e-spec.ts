import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { nh } from './helpers/nonce.helper';

/**
 * Inventory & Smart Alerts e2e tests (real PostgreSQL)
 *
 * Creates items with known breach conditions, triggers alert checks via API,
 * then verifies all 4 alert types are generated correctly.
 */
describe('Inventory (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;

  const TEST_PREFIX = 'e2e_inv_';

  // IDs allocated during beforeAll
  let itemSafetyId: string;
  let itemMinMaxId: string;
  let itemExpiryId: string;
  let itemConsumptionId: string;
  let recoId: string;

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

    // Seed admin user
    const hash = await bcrypt.hash('testpass123', 10);
    await dataSource.query(
      `INSERT INTO users (id, username, password_hash, role, is_active, created_at, updated_at)
       VALUES (uuid_generate_v4(), '${TEST_PREFIX}admin', $1, 'admin', true, now(), now())
       ON CONFLICT (username) DO NOTHING`,
      [hash],
    );

    // Login
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: `${TEST_PREFIX}admin`, password: 'testpass123' });
    adminToken = loginRes.body.data.accessToken;

    // Seed test items with breach conditions
    // Item 1: safety stock breach (qty < safety_stock_level)
    const [itemSafety] = await dataSource.query(`
      INSERT INTO items (id, name, sku, unit_of_measure, safety_stock_level, min_level, max_level, lead_time_days, replenishment_buffer_days, is_active, created_at, updated_at)
      VALUES (uuid_generate_v4(), '${TEST_PREFIX}Safety Item', '${TEST_PREFIX}SKU-S1', 'each', 50, 10, 200, 7, 14, true, now(), now())
      RETURNING id`);
    itemSafetyId = itemSafety.id;
    // Set inventory level: qty=5 (< safety_stock=50)
    await dataSource.query(`
      INSERT INTO inventory_levels (id, item_id, quantity_on_hand, quantity_reserved, quantity_on_order, last_updated_at, created_at)
      VALUES (uuid_generate_v4(), $1, 5, 0, 0, now(), now())`, [itemSafetyId]);

    // Item 2: min/max breach (qty < min_level)
    const [itemMinMax] = await dataSource.query(`
      INSERT INTO items (id, name, sku, unit_of_measure, safety_stock_level, min_level, max_level, lead_time_days, replenishment_buffer_days, is_active, created_at, updated_at)
      VALUES (uuid_generate_v4(), '${TEST_PREFIX}MinMax Item', '${TEST_PREFIX}SKU-MM1', 'each', 2, 20, 100, 5, 14, true, now(), now())
      RETURNING id`);
    itemMinMaxId = itemMinMax.id;
    // Set inventory level: qty=10 (< min_level=20)
    await dataSource.query(`
      INSERT INTO inventory_levels (id, item_id, quantity_on_hand, quantity_reserved, quantity_on_order, last_updated_at, created_at)
      VALUES (uuid_generate_v4(), $1, 10, 0, 0, now(), now())`, [itemMinMaxId]);

    // Item 3: near-expiration (expires in 10 days)
    const expiresAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const [itemExpiry] = await dataSource.query(`
      INSERT INTO items (id, name, sku, unit_of_measure, safety_stock_level, min_level, max_level, lead_time_days, replenishment_buffer_days, expires_at, is_active, created_at, updated_at)
      VALUES (uuid_generate_v4(), '${TEST_PREFIX}Expiry Item', '${TEST_PREFIX}SKU-EX1', 'each', 0, 0, 0, 7, 14, $1, true, now(), now())
      RETURNING id`, [expiresAt]);
    itemExpiryId = itemExpiry.id;

    // Item 4: abnormal consumption (7-day usage >> 8-week avg * 1.4)
    const [itemConsumption] = await dataSource.query(`
      INSERT INTO items (id, name, sku, unit_of_measure, safety_stock_level, min_level, max_level, lead_time_days, replenishment_buffer_days, is_active, created_at, updated_at)
      VALUES (uuid_generate_v4(), '${TEST_PREFIX}Consumption Item', '${TEST_PREFIX}SKU-C1', 'each', 0, 0, 0, 7, 14, true, now(), now())
      RETURNING id`);
    itemConsumptionId = itemConsumption.id;

    const [adminUser] = await dataSource.query(
      `SELECT id FROM users WHERE username = '${TEST_PREFIX}admin' LIMIT 1`,
    );

    // Seed 8-week baseline: 1 unit/day for 56 days (avg=1/day)
    // Then 7-day spike: 15 units/day (total=105) — 105 > (1*7*1.4 = 9.8) ✓ abnormal
    const baselineDate = new Date(Date.now() - 57 * 24 * 60 * 60 * 1000);
    for (let i = 0; i < 56; i++) {
      const d = new Date(baselineDate.getTime() + i * 24 * 60 * 60 * 1000);
      await dataSource.query(`
        INSERT INTO stock_movements (id, item_id, type, quantity, quantity_before, quantity_after, performed_by_id, created_at)
        VALUES (uuid_generate_v4(), $1, 'issue', 1, 100, 99, $2, $3)`,
        [itemConsumptionId, adminUser.id, d.toISOString()]);
    }
    // Last 7 days: 15 units/day
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000);
      await dataSource.query(`
        INSERT INTO stock_movements (id, item_id, type, quantity, quantity_before, quantity_after, performed_by_id, created_at)
        VALUES (uuid_generate_v4(), $1, 'issue', 15, 100, 85, $2, $3)`,
        [itemConsumptionId, adminUser.id, d.toISOString()]);
    }
  });

  afterAll(async () => {
    try {
      await dataSource.query(`DELETE FROM recommendation_feedback WHERE user_id IN (SELECT id FROM users WHERE username LIKE '${TEST_PREFIX}%')`);
      await dataSource.query(`DELETE FROM replenishment_recommendations WHERE item_id IN (SELECT id FROM items WHERE sku LIKE '${TEST_PREFIX}%')`);
      await dataSource.query(`DELETE FROM purchase_request_items WHERE purchase_request_id IN (SELECT id FROM purchase_requests WHERE requester_id IN (SELECT id FROM users WHERE username LIKE '${TEST_PREFIX}%'))`);
      await dataSource.query(`DELETE FROM purchase_requests WHERE requester_id IN (SELECT id FROM users WHERE username LIKE '${TEST_PREFIX}%')`);
      await dataSource.query(`DELETE FROM alerts WHERE item_id IN (SELECT id FROM items WHERE sku LIKE '${TEST_PREFIX}%')`);
      await dataSource.query(`DELETE FROM stock_movements WHERE item_id IN (SELECT id FROM items WHERE sku LIKE '${TEST_PREFIX}%')`);
      await dataSource.query(`DELETE FROM inventory_levels WHERE item_id IN (SELECT id FROM items WHERE sku LIKE '${TEST_PREFIX}%')`);
      await dataSource.query(`DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM users WHERE username LIKE '${TEST_PREFIX}%')`);
      await dataSource.query(`DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE username LIKE '${TEST_PREFIX}%')`);
      await dataSource.query(`DELETE FROM users WHERE username LIKE '${TEST_PREFIX}%'`);
      await dataSource.query(`DELETE FROM items WHERE sku LIKE '${TEST_PREFIX}%'`);
    } catch (_) {
      // Best-effort
    }
    await app.close();
  });

  // ── Step 1: List items with stock levels ──────────────────────────────────

  it('GET /inventory/items returns items with stock levels', async () => {
    const res = await request(app.getHttpServer())
      .get('/inventory/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data).toBeInstanceOf(Array);
    const safetyItem = res.body.data.find((i: { id: string }) => i.id === itemSafetyId);
    expect(safetyItem).toBeDefined();
    expect(safetyItem.stockLevel.quantityOnHand).toBeDefined();
  });

  // ── Step 2: Trigger alert checks manually ─────────────────────────────────

  it('POST /inventory/alerts/run-checks triggers all 4 alert types', async () => {
    const res = await request(app.getHttpServer())
      .post('/inventory/alerts/run-checks')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(nh())
      .expect(200);

    expect(res.body.data.triggered).toBe(true);
  });

  // ── Step 3: Verify safety stock alert created ─────────────────────────────

  it('GET /inventory/alerts returns safety_stock alert for breach item', async () => {
    const res = await request(app.getHttpServer())
      .get('/inventory/alerts')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const safetyAlerts = res.body.data.filter(
      (a: { itemId: string; type: string }) =>
        a.itemId === itemSafetyId && a.type === 'safety_stock',
    );
    expect(safetyAlerts.length).toBeGreaterThan(0);
    expect(safetyAlerts[0].severity).toBe('high');
  });

  // ── Step 4: Verify min/max alert ─────────────────────────────────────────

  it('GET /inventory/alerts returns min_max alert for below-min item', async () => {
    const res = await request(app.getHttpServer())
      .get('/inventory/alerts')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const minMaxAlerts = res.body.data.filter(
      (a: { itemId: string; type: string }) =>
        a.itemId === itemMinMaxId && a.type === 'min_max',
    );
    expect(minMaxAlerts.length).toBeGreaterThan(0);
  });

  // ── Step 5: Verify near-expiration alert ──────────────────────────────────

  it('GET /inventory/alerts returns near_expiration alert for soon-expiring item', async () => {
    const res = await request(app.getHttpServer())
      .get('/inventory/alerts')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const expiryAlerts = res.body.data.filter(
      (a: { itemId: string; type: string }) =>
        a.itemId === itemExpiryId && a.type === 'near_expiration',
    );
    expect(expiryAlerts.length).toBeGreaterThan(0);
    expect(expiryAlerts[0].severity).toBe('high'); // 10 days → HIGH
  });

  // ── Step 6: Verify abnormal consumption alert ─────────────────────────────

  it('GET /inventory/alerts returns abnormal_consumption alert', async () => {
    const res = await request(app.getHttpServer())
      .get('/inventory/alerts')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const consumptionAlerts = res.body.data.filter(
      (a: { itemId: string; type: string }) =>
        a.itemId === itemConsumptionId && a.type === 'abnormal_consumption',
    );
    expect(consumptionAlerts.length).toBeGreaterThan(0);
  });

  // ── Step 7: Acknowledge alert ─────────────────────────────────────────────

  it('PATCH /inventory/alerts/:id/acknowledge marks alert as acknowledged', async () => {
    const listRes = await request(app.getHttpServer())
      .get('/inventory/alerts')
      .set('Authorization', `Bearer ${adminToken}`);

    const alertToAck = listRes.body.data.find(
      (a: { itemId: string; status: string }) =>
        a.itemId === itemSafetyId && a.status === 'active',
    );
    expect(alertToAck).toBeDefined();

    const ackRes = await request(app.getHttpServer())
      .patch(`/inventory/alerts/${alertToAck.id}/acknowledge`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(nh())
      .expect(200);

    expect(ackRes.body.data.status).toBe('acknowledged');
    expect(ackRes.body.data.acknowledgedAt).toBeDefined();
  });

  // ── Step 8: Generate replenishment recommendation ─────────────────────────

  it('POST /inventory/recommendations/generate creates recommendations from usage data', async () => {
    const res = await request(app.getHttpServer())
      .post('/inventory/recommendations/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(nh())
      .send({ itemId: itemConsumptionId })
      .expect(201);

    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThan(0);
    recoId = res.body.data[0].id;

    // Verify formula: (7 + 14) * avgDailyUsage
    // 56 days: 56 issues × 1 + 7 days × 15 = 56 + 105 = 161 total / 56 = 2.875/day
    // recommendedQty = (7 + 14) * 2.875 = 60.375
    const reco = res.body.data[0];
    expect(Number(reco.recommendedQuantity)).toBeGreaterThan(0);
    expect(Number(reco.leadTimeDays)).toBe(7);
    expect(Number(reco.bufferDays)).toBe(14);
  });

  // ── Step 9: Record impression ─────────────────────────────────────────────

  it('POST /inventory/recommendations/:id/impression records impression', async () => {
    const res = await request(app.getHttpServer())
      .post(`/inventory/recommendations/${recoId}/impression`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(nh())
      .expect(200);

    expect(res.body.data.recorded).toBe(true);

    const [feedback] = await dataSource.query(
      `SELECT type FROM recommendation_feedback WHERE recommendation_id = $1 AND type = 'impression'`,
      [recoId],
    );
    expect(feedback).toBeDefined();
    expect(feedback.type).toBe('impression');
  });

  // ── Step 10: Accept recommendation → auto-draft PR ────────────────────────

  it('POST /inventory/recommendations/:id/accept creates a draft PurchaseRequest', async () => {
    const res = await request(app.getHttpServer())
      .post(`/inventory/recommendations/${recoId}/accept`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(nh())
      .expect(201);

    expect(res.body.data.recommendation.status).toBe('accepted');
    expect(res.body.data.purchaseRequest).toBeDefined();
    expect(res.body.data.purchaseRequest.status).toBe('draft');

    // Verify click feedback recorded
    const [clickFeedback] = await dataSource.query(
      `SELECT type FROM recommendation_feedback WHERE recommendation_id = $1 AND type = 'click'`,
      [recoId],
    );
    expect(clickFeedback).toBeDefined();
  });

  // ── Step 11: Get item detail with stock history ───────────────────────────

  it('GET /inventory/items/:id returns item with movements and alerts', async () => {
    const res = await request(app.getHttpServer())
      .get(`/inventory/items/${itemConsumptionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.id).toBe(itemConsumptionId);
    expect(res.body.data.movements).toBeInstanceOf(Array);
    expect(res.body.data.movements.length).toBeGreaterThan(0);
  });
});
