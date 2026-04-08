import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import { encrypt, blindIndex } from '../common/transformers/aes.transformer';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'meridianmed',
  username: process.env.DB_USER || 'meridian',
  password: process.env.DB_PASSWORD || 'dev-only-password-change-in-production',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: false,
  logging: false,
});

async function seed() {
  await AppDataSource.initialize();
  process.stdout.write('DB connected — starting seed...\n');

  const userCount = await AppDataSource.query(
    `SELECT COUNT(*)::int AS cnt FROM users WHERE deleted_at IS NULL`,
  );
  if (userCount[0].cnt > 0) {
    process.stdout.write('Seed data already present — skipping.\n');
    await AppDataSource.destroy();
    return;
  }

  const hash = (pw: string) => bcrypt.hash(pw, 12);
  const PASSWORD = 'meridian2024';

  // ── Users ────────────────────────────────────────────────────────────────
  const [adminHash, supHash, hrHash, empHash] = await Promise.all([
    hash(PASSWORD),
    hash(PASSWORD),
    hash(PASSWORD),
    hash(PASSWORD),
  ]);

  const users = [
    { name: 'admin',      hash: adminHash, role: 'admin' },
    { name: 'supervisor', hash: supHash,   role: 'supervisor' },
    { name: 'hr',         hash: hrHash,    role: 'hr' },
    { name: 'employee',   hash: empHash,   role: 'employee' },
  ];
  for (const u of users) {
    await AppDataSource.query(
      `INSERT INTO users (id, username, username_hash, password_hash, role, is_active, created_at, updated_at)
       VALUES (uuid_generate_v4(), $1, $2, $3, $4, true, now(), now())
       ON CONFLICT DO NOTHING`,
      [encrypt(u.name), blindIndex(u.name), u.hash, u.role],
    );
  }
  process.stdout.write('✓ Users seeded\n');

  // ── Vendors ──────────────────────────────────────────────────────────────
  await AppDataSource.query(`
    INSERT INTO vendors (id, name, contact_name, email, phone, is_active, created_at, updated_at)
    VALUES
      (uuid_generate_v4(), 'MedSupply Corp',      'Jane Carter',   'jane@medsupply.example',    '+1-555-0100', true, now(), now()),
      (uuid_generate_v4(), 'LabPro Distributors', 'Mark Huang',    'mark@labpro.example',       '+1-555-0101', true, now(), now()),
      (uuid_generate_v4(), 'BioSource Inc',       'Sara Patel',    'sara@biosource.example',    '+1-555-0102', true, now(), now()),
      (uuid_generate_v4(), 'PharmaDirect',        'Tom Weiss',     'tom@pharmadirect.example',  '+1-555-0103', true, now(), now()),
      (uuid_generate_v4(), 'EquipCare Ltd',       'Lisa Morgan',   'lisa@equipcare.example',    '+1-555-0104', true, now(), now())
  `);
  process.stdout.write('✓ Vendors seeded\n');

  // ── Item categories ──────────────────────────────────────────────────────
  await AppDataSource.query(`
    INSERT INTO item_categories (id, name, description, created_at, updated_at)
    VALUES
      (uuid_generate_v4(), 'Lab Reagents',       'Chemical reagents used in laboratory testing',   now(), now()),
      (uuid_generate_v4(), 'PPE',                'Personal protective equipment',                  now(), now()),
      (uuid_generate_v4(), 'Medical Consumables','Single-use medical supplies',                    now(), now()),
      (uuid_generate_v4(), 'Diagnostic Equipment','Reusable diagnostic instruments and devices',   now(), now()),
      (uuid_generate_v4(), 'Office Supplies',    'General office and administrative supplies',     now(), now())
  `);
  process.stdout.write('✓ Item categories seeded\n');

  // ── Items ────────────────────────────────────────────────────────────────
  const categories = await AppDataSource.query(
    `SELECT id, name FROM item_categories ORDER BY name`,
  );
  const catId = (name: string) =>
    categories.find((c: { id: string; name: string }) => c.name === name)?.id;

  await AppDataSource.query(`
    INSERT INTO items (
      id, name, sku, description, unit_of_measure,
      category_id, safety_stock_level, min_level, max_level,
      lead_time_days, replenishment_buffer_days, is_active,
      created_at, updated_at
    ) VALUES
      (uuid_generate_v4(), 'Nitrile Gloves (M)', 'PPE-GLV-M-100',   'Box of 100 medium nitrile gloves', 'box',   $1, 20, 10,  100, 3,  14, true, now(), now()),
      (uuid_generate_v4(), 'Nitrile Gloves (L)', 'PPE-GLV-L-100',   'Box of 100 large nitrile gloves',  'box',   $1, 20, 10,  100, 3,  14, true, now(), now()),
      (uuid_generate_v4(), 'Surgical Mask N95',  'PPE-MSK-N95-20',  'Pack of 20 N95 surgical masks',    'pack',  $1, 30, 15,  150, 5,  14, true, now(), now()),
      (uuid_generate_v4(), 'CBC Reagent Kit',    'LAB-CBC-KIT-50',  '50-test CBC reagent kit',          'kit',   $2, 5,  2,   20,  7,  14, true, now(), now()),
      (uuid_generate_v4(), 'Glucose Test Strip', 'LAB-GLU-STR-100', 'Box of 100 glucose test strips',   'box',   $2, 10, 5,   50,  5,  14, true, now(), now()),
      (uuid_generate_v4(), 'Hemoglobin Reagent', 'LAB-HGB-REA-500', '500 ml hemoglobin reagent',        'bottle',$2, 4,  2,   15,  10, 14, true, now(), now()),
      (uuid_generate_v4(), 'Syringe 5ml',        'CON-SYR-5ML-50',  'Pack of 50 × 5 ml syringes',       'pack',  $3, 40, 20,  200, 3,  14, true, now(), now()),
      (uuid_generate_v4(), 'IV Catheter 20G',    'CON-IVC-20G-50',  'Pack of 50 20-gauge IV catheters', 'pack',  $3, 25, 10,  100, 5,  14, true, now(), now()),
      (uuid_generate_v4(), 'Specimen Cup 60ml',  'CON-SPC-60ML-100','Pack of 100 specimen cups 60 ml',  'pack',  $3, 15, 8,   80,  5,  14, true, now(), now()),
      (uuid_generate_v4(), 'Digital Thermometer','EQP-THM-DIG-001', 'Digital clinical thermometer',     'unit',  $4, 5,  2,   20,  7,  14, true, now(), now())
  `, [catId('PPE'), catId('Lab Reagents'), catId('Medical Consumables'), catId('Diagnostic Equipment')]);
  process.stdout.write('✓ Items seeded\n');

  // ── Inventory levels for each item ───────────────────────────────────────
  await AppDataSource.query(`
    INSERT INTO inventory_levels (id, item_id, quantity_on_hand, quantity_reserved, quantity_on_order, last_updated_at, created_at)
    SELECT uuid_generate_v4(), id,
      FLOOR(RANDOM() * 80 + 20)::numeric,
      0, 0, now(), now()
    FROM items
    ON CONFLICT DO NOTHING
  `);
  process.stdout.write('✓ Inventory levels seeded\n');

  // ── Lab test dictionary ───────────────────────────────────────────────────
  await AppDataSource.query(`
    INSERT INTO lab_test_dictionaries (id, name, test_code, description, sample_type, unit, is_active, created_at, updated_at)
    VALUES
      (uuid_generate_v4(), 'Complete Blood Count',        'CBC',      'Full blood panel including RBC, WBC, platelets', 'whole_blood', 'count/uL', true, now(), now()),
      (uuid_generate_v4(), 'Fasting Blood Glucose',       'FBG',      'Blood glucose after 8-hour fast',                'serum',       'mg/dL',    true, now(), now()),
      (uuid_generate_v4(), 'Hemoglobin A1c',              'HBA1C',    'Glycated hemoglobin 3-month average',            'whole_blood', '%',        true, now(), now()),
      (uuid_generate_v4(), 'Lipid Panel',                 'LIPID',    'Total cholesterol, LDL, HDL, triglycerides',     'serum',       'mg/dL',    true, now(), now()),
      (uuid_generate_v4(), 'Serum Creatinine',            'SCR',      'Kidney function marker',                         'serum',       'mg/dL',    true, now(), now()),
      (uuid_generate_v4(), 'Alanine Aminotransferase',    'ALT',      'Liver enzyme marker',                            'serum',       'U/L',      true, now(), now()),
      (uuid_generate_v4(), 'Thyroid Stimulating Hormone', 'TSH',      'Thyroid function test',                          'serum',       'mIU/L',    true, now(), now()),
      (uuid_generate_v4(), 'Urinalysis',                  'UA',       'Complete urine analysis',                        'urine',       NULL,       true, now(), now()),
      (uuid_generate_v4(), 'C-Reactive Protein',          'CRP',      'Inflammation marker',                            'serum',       'mg/L',     true, now(), now()),
      (uuid_generate_v4(), 'Prothrombin Time',            'PT',       'Blood coagulation test',                         'plasma',      'seconds',  true, now(), now())
  `);
  process.stdout.write('✓ Lab test dictionary seeded\n');

  // ── Reference ranges for selected tests ──────────────────────────────────
  const tests = await AppDataSource.query(
    `SELECT id, test_code FROM lab_test_dictionaries`,
  );
  const testId = (code: string) =>
    tests.find((t: { id: string; test_code: string }) => t.test_code === code)?.id;

  await AppDataSource.query(`
    INSERT INTO reference_ranges (id, test_id, population, min_value, max_value, critical_low, critical_high)
    VALUES
      (uuid_generate_v4(), $1, 'Adult',  70,   100,  50,   400),
      (uuid_generate_v4(), $2, 'Adult',  4.0,  5.6,  NULL, 6.5),
      (uuid_generate_v4(), $3, 'Adult',  8,    11,   6,    40),
      (uuid_generate_v4(), $4, 'Adult',  0.7,  1.2,  NULL, 10),
      (uuid_generate_v4(), $5, 'Adult',  0.4,  4.0,  NULL, 10)
  `, [
    testId('FBG'),
    testId('HBA1C'),
    testId('ALT'),
    testId('SCR'),
    testId('TSH'),
  ]);
  process.stdout.write('✓ Reference ranges seeded\n');

  process.stdout.write('\n✅  Seed complete.\n');
  await AppDataSource.destroy();
}

seed().catch((err) => {
  process.stderr.write(`Seed failed: ${err}\n`);
  process.exit(1);
});
