import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { encrypt, blindIndex } from '../../src/common/transformers/aes.transformer';

/**
 * Insert a test user with encrypted username and HMAC blind index.
 * Uses ON CONFLICT DO NOTHING so it's safe to call repeatedly.
 */
export async function seedTestUser(
  ds: DataSource,
  username: string,
  role: string,
  password = 'meridian2024',
  isActive = true,
): Promise<void> {
  const hash = await bcrypt.hash(password, 10);
  await ds.query(
    `INSERT INTO users (id, username, username_hash, password_hash, role, is_active, created_at, updated_at)
     VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, now(), now())
     ON CONFLICT DO NOTHING`,
    [encrypt(username), blindIndex(username), hash, role, isActive],
  );
}

/**
 * Seed multiple test users at once.
 */
export async function seedTestUsers(
  ds: DataSource,
  users: Array<{ username: string; role: string; isActive?: boolean }>,
  password = 'meridian2024',
): Promise<void> {
  for (const u of users) {
    await seedTestUser(ds, u.username, u.role, password, u.isActive ?? true);
  }
}
