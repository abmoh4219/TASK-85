import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { nh } from './helpers/nonce.helper';
import { seedTestUsers } from './helpers/seed-user.helper';
import { blindIndex } from '../src/common/transformers/aes.transformer';

/**
 * Full procurement flow e2e test (real PostgreSQL via docker-compose.test.yml)
 *
 * Flow: create PR → submit → approve → create RFQ → add quotes → get comparison
 *       → create PO → approve PO (30-day price lock) → reject price update
 *       → receive (partial) → inspect → put-away (inventory update) → reconcile
 */
describe('Procurement (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // Tokens for two roles used in this test
  let adminToken: string;
  let employeeToken: string;

  // IDs used across all steps
  let vendorId: string;
  let itemId: string;
  let prId: string;
  let rfqId: string;
  let rfqLineId: string;
  let poId: string;
  let poLineId: string;
  let receiptId: string;
  let receiptLineId: string;

  // Test-scoped user IDs for cleanup
  const TEST_PREFIX = 'e2e_proc_';

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

    // Seed test-scoped users
    await seedTestUsers(dataSource, [
      { username: `${TEST_PREFIX}admin`, role: 'admin' },
      { username: `${TEST_PREFIX}employee`, role: 'employee' },
    ], 'testpass123');

    // Seed a test vendor (vendors table has no unique constraint on name, so check first)
    const existingVendor = await dataSource.query(
      `SELECT id FROM vendors WHERE name = '${TEST_PREFIX}Vendor' LIMIT 1`,
    );
    if (existingVendor.length === 0) {
      await dataSource.query(
        `INSERT INTO vendors (id, name, is_active, created_at, updated_at)
         VALUES (uuid_generate_v4(), '${TEST_PREFIX}Vendor', true, now(), now())`,
      );
    }

    // Seed a test item category + item
    await dataSource.query(
      `INSERT INTO item_categories (id, name, created_at, updated_at)
       VALUES (uuid_generate_v4(), '${TEST_PREFIX}Category', now(), now())
       ON CONFLICT DO NOTHING`,
    );
    await dataSource.query(
      `INSERT INTO items (id, name, sku, unit_of_measure, is_active, created_at, updated_at)
       VALUES (uuid_generate_v4(), '${TEST_PREFIX}Item', '${TEST_PREFIX}SKU-001', 'each', true, now(), now())
       ON CONFLICT (sku) DO NOTHING`,
    );

    // Retrieve seeded IDs
    const [vendorRow] = await dataSource.query(
      `SELECT id FROM vendors WHERE name = '${TEST_PREFIX}Vendor' LIMIT 1`,
    );
    vendorId = vendorRow.id;

    const [itemRow] = await dataSource.query(
      `SELECT id FROM items WHERE sku = '${TEST_PREFIX}SKU-001' LIMIT 1`,
    );
    itemId = itemRow.id;

    // Login for both roles
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
    // Clean up in FK-safe order
    try {
      const hashes = [
        blindIndex(`${TEST_PREFIX}admin`),
        blindIndex(`${TEST_PREFIX}employee`),
      ];
      await dataSource.query(`DELETE FROM reconciliations WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE po_number LIKE 'PO-%' AND created_by_id IN (SELECT id FROM users WHERE username_hash = ANY($1)))`, [hashes]);
      await dataSource.query(`DELETE FROM put_aways WHERE stored_by_id IN (SELECT id FROM users WHERE username_hash = ANY($1))`, [hashes]);
      await dataSource.query(`DELETE FROM po_receipt_lines WHERE receipt_id IN (SELECT id FROM po_receipts WHERE received_by_id IN (SELECT id FROM users WHERE username_hash = ANY($1)))`, [hashes]);
      await dataSource.query(`DELETE FROM po_receipts WHERE received_by_id IN (SELECT id FROM users WHERE username_hash = ANY($1))`, [hashes]);
      await dataSource.query(`DELETE FROM po_lines WHERE purchase_order_id IN (SELECT id FROM purchase_orders WHERE created_by_id IN (SELECT id FROM users WHERE username_hash = ANY($1)))`, [hashes]);
      await dataSource.query(`DELETE FROM purchase_orders WHERE created_by_id IN (SELECT id FROM users WHERE username_hash = ANY($1))`, [hashes]);
      await dataSource.query(`DELETE FROM vendor_quotes WHERE vendor_id = '${vendorId}'`);
      await dataSource.query(`DELETE FROM rfq_lines WHERE rfq_id IN (SELECT id FROM rfqs WHERE created_by_id IN (SELECT id FROM users WHERE username_hash = ANY($1)))`, [hashes]);
      await dataSource.query(`DELETE FROM rfqs WHERE created_by_id IN (SELECT id FROM users WHERE username_hash = ANY($1))`, [hashes]);
      await dataSource.query(`DELETE FROM purchase_request_items WHERE purchase_request_id IN (SELECT id FROM purchase_requests WHERE requester_id IN (SELECT id FROM users WHERE username_hash = ANY($1)))`, [hashes]);
      await dataSource.query(`DELETE FROM purchase_requests WHERE requester_id IN (SELECT id FROM users WHERE username_hash = ANY($1))`, [hashes]);
      await dataSource.query(`DELETE FROM stock_movements WHERE item_id = '${itemId}'`);
      await dataSource.query(`DELETE FROM inventory_levels WHERE item_id = '${itemId}'`);
      await dataSource.query(`DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM users WHERE username_hash = ANY($1))`, [hashes]);
      await dataSource.query(`DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE username_hash = ANY($1))`, [hashes]);
      await dataSource.query(`DELETE FROM users WHERE username_hash = ANY($1)`, [hashes]);
      await dataSource.query(`DELETE FROM items WHERE sku = '${TEST_PREFIX}SKU-001'`);
      await dataSource.query(`DELETE FROM vendors WHERE name = '${TEST_PREFIX}Vendor'`);
      await dataSource.query(`DELETE FROM item_categories WHERE name = '${TEST_PREFIX}Category'`);
    } catch (_) {
      // Best-effort cleanup — do not fail the suite
    }
    await app.close();
  });

  // ── Step 1: Create Purchase Request ──────────────────────────────────────

  it('Step 1: employee creates a purchase request', async () => {
    const res = await request(app.getHttpServer())
      .post('/procurement/requests')
      .set('Authorization', `Bearer ${employeeToken}`)
      .set(nh())
      .send({
        justification: 'E2E test requisition',
        items: [
          { itemId, quantity: 100, unitOfMeasure: 'each', notes: 'urgent' },
        ],
      })
      .expect(201);

    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.items).toHaveLength(1);
    prId = res.body.data.id;
  });

  // ── Step 2: Submit PR ─────────────────────────────────────────────────────

  it('Step 2: employee submits the purchase request', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/procurement/requests/${prId}/submit`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .set(nh())
      .expect(200);

    expect(res.body.data.status).toBe('submitted');
  });

  // ── Step 3: Approve PR ────────────────────────────────────────────────────

  it('Step 3: admin approves the purchase request', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/procurement/requests/${prId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(nh())
      .expect(200);

    expect(res.body.data.status).toBe('approved');
  });

  // ── Step 4: Create RFQ ────────────────────────────────────────────────────

  it('Step 4: admin creates an RFQ from the approved PR', async () => {
    const res = await request(app.getHttpServer())
      .post('/procurement/rfq')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(nh())
      .send({
        purchaseRequestId: prId,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        lines: [
          { itemId, quantity: 100, unitOfMeasure: 'each' },
        ],
      })
      .expect(201);

    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.lines).toHaveLength(1);
    rfqId = res.body.data.id;
    rfqLineId = res.body.data.lines[0].id;
  });

  // ── Step 5: Add vendor quote ──────────────────────────────────────────────

  it('Step 5: admin adds a vendor quote to the RFQ', async () => {
    const res = await request(app.getHttpServer())
      .post(`/procurement/rfq/${rfqId}/quotes`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(nh())
      .send({
        rfqLineId,
        vendorId,
        unitPrice: 25.5,
        leadTimeDays: 5,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Best price available',
      })
      .expect(201);

    expect(res.body.data.unitPrice).toBeDefined();
  });

  // ── Step 6: Get quote comparison ──────────────────────────────────────────

  it('Step 6: admin gets side-by-side quote comparison', async () => {
    const res = await request(app.getHttpServer())
      .get(`/procurement/rfq/${rfqId}/comparison`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.lines).toHaveLength(1);
    expect(res.body.data.lines[0].quotes).toHaveLength(1);
    expect(res.body.data.lines[0].quotes[0].unitPrice).toBe(25.5);
    expect(res.body.data.lines[0].quotes[0].totalPrice).toBe(2550);
  });

  // ── Step 7: Create PO ─────────────────────────────────────────────────────

  it('Step 7: admin creates a Purchase Order', async () => {
    const res = await request(app.getHttpServer())
      .post('/procurement/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .set(nh())
      .send({
        rfqId,
        vendorId,
        notes: 'E2E test PO',
        lines: [
          { itemId, quantity: 100, unitPrice: 25.5, unitOfMeasure: 'each' },
        ],
      })
      .expect(201);

    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.lines).toHaveLength(1);
    poId = res.body.data.id;
    poLineId = res.body.data.lines[0].id;
  });

  // ── Step 8: Approve PO (triggers 30-day price lock) ───────────────────────

  it('Step 8: admin approves the PO, setting 30-day price lock', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/procurement/orders/${poId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(nh())
      .expect(200);

    expect(res.body.data.status).toBe('approved');
    expect(res.body.data.priceLockedUntil).toBeDefined();

    const lockDate = new Date(res.body.data.priceLockedUntil);
    const expectedMinLock = new Date(Date.now() + 29 * 24 * 60 * 60 * 1000);
    expect(lockDate.getTime()).toBeGreaterThan(expectedMinLock.getTime());
  });

  // ── Step 9: Price update rejected within 30-day lock ─────────────────────

  it('Step 9: price update within 30-day lock returns 400', async () => {
    await request(app.getHttpServer())
      .patch(`/procurement/orders/${poId}/lines/${poLineId}/price`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(nh())
      .send({ unitPrice: 30 })
      .expect(400);
  });

  // ── Step 10: Receive order (partial — 60 of 100) ──────────────────────────

  it('Step 10: admin records partial receipt (60 of 100 units)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/procurement/orders/${poId}/receipts`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(nh())
      .send({
        notes: 'Partial delivery',
        lines: [
          {
            poLineId,
            receivedQuantity: 60,
            lotNumber: 'LOT-E2E-001',
            expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
      })
      .expect(201);

    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.lines).toHaveLength(1);
    receiptId = res.body.data.id;
    receiptLineId = res.body.data.lines[0].id;

    // Verify PO is now PARTIALLY_RECEIVED
    const poRes = await request(app.getHttpServer())
      .get(`/procurement/orders/${poId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(poRes.body.data.status).toBe('partially_received');
  });

  // ── Step 11: Inspect receipt ──────────────────────────────────────────────

  it('Step 11: admin inspects receipt and marks lines PASSED', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/procurement/receipts/${receiptId}/inspect`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(nh())
      .send({
        lines: [
          { receiptLineId, result: 'passed', notes: 'All items in good condition' },
        ],
      })
      .expect(200);

    expect(res.body.data.status).toBe('passed');
    expect(res.body.data.lines[0].inspectionResult).toBe('passed');
  });

  // ── Step 12: Put-away (updates inventory) ─────────────────────────────────

  it('Step 12: admin puts away received goods and inventory level increases', async () => {
    // Capture inventory before
    const [invBefore] = await dataSource.query(
      `SELECT quantity_on_hand FROM inventory_levels WHERE item_id = $1`,
      [itemId],
    );
    const qtyBefore = invBefore ? Number(invBefore.quantity_on_hand) : 0;

    await request(app.getHttpServer())
      .post(`/procurement/receipts/${receiptId}/putaway`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(nh())
      .send({
        lines: [
          { receiptLineId, location: 'Shelf A-1', quantityStored: 60 },
        ],
      })
      .expect(201);

    // Verify inventory level increased by 60
    const [invAfter] = await dataSource.query(
      `SELECT quantity_on_hand FROM inventory_levels WHERE item_id = $1`,
      [itemId],
    );
    expect(Number(invAfter.quantity_on_hand)).toBe(qtyBefore + 60);

    // Verify StockMovement record created
    const movements = await dataSource.query(
      `SELECT * FROM stock_movements WHERE item_id = $1 AND type = 'receipt' ORDER BY created_at DESC LIMIT 1`,
      [itemId],
    );
    expect(movements).toHaveLength(1);
    expect(Number(movements[0].quantity)).toBe(60);
  });

  // ── Step 13: Reconcile order ──────────────────────────────────────────────

  it('Step 13: admin reconciles order — detects discrepancy (60 received vs 100 ordered)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/procurement/orders/${poId}/reconcile`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set(nh())
      .expect(201);

    // 60 received vs 100 ordered → discrepancy
    expect(res.body.data.status).toBe('discrepancy');
    expect(res.body.data.discrepancies).toHaveLength(1);
    expect(res.body.data.discrepancies[0].ordered).toBe(100);
    expect(res.body.data.discrepancies[0].received).toBe(60);
  });

  // ── Step 14: RBAC — employee cannot approve PR ────────────────────────────

  it('Step 14: employee cannot approve a purchase request (403)', async () => {
    // Create a fresh PR to test RBAC
    const createRes = await request(app.getHttpServer())
      .post('/procurement/requests')
      .set('Authorization', `Bearer ${employeeToken}`)
      .set(nh())
      .send({
        justification: 'RBAC test',
        items: [{ itemId, quantity: 1, unitOfMeasure: 'each' }],
      })
      .expect(201);

    const newPrId = createRes.body.data.id;

    await request(app.getHttpServer())
      .patch(`/procurement/requests/${newPrId}/submit`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .set(nh())
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/procurement/requests/${newPrId}/approve`)
      .set('Authorization', `Bearer ${employeeToken}`)
      .set(nh())
      .expect(403);
  });

  // ── Step 15: Audit log populated ─────────────────────────────────────────

  it('Step 15: audit log has entries for all state transitions', async () => {
    const auditHashes = [
      blindIndex(`${TEST_PREFIX}admin`),
      blindIndex(`${TEST_PREFIX}employee`),
    ];
    const logs = await dataSource.query(
      `SELECT action, entity_type FROM audit_logs
       WHERE user_id IN (SELECT id FROM users WHERE username_hash = ANY($1))
       ORDER BY timestamp ASC`,
      [auditHashes],
    );

    const actions = logs.map((l: { action: string }) => l.action);
    expect(actions).toContain('CREATE');
    expect(actions).toContain('SUBMIT');
    expect(actions).toContain('APPROVE');
    expect(actions).toContain('RECEIVE');
    expect(actions).toContain('INSPECT');
    expect(actions).toContain('PUT_AWAY');
    expect(actions).toContain('RECONCILE');
  });
});
