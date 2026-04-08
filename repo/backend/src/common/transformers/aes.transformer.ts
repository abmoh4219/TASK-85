import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
const KEY_LENGTH = 32;

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.length < 16) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is required and must be at least 16 characters. ' +
      'Set it in docker-compose.yml or your environment before starting the application.',
    );
  }
  // Derive a 32-byte key deterministically from the env var
  return crypto.createHash('sha256').update(raw).digest().slice(0, KEY_LENGTH);
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(ciphertext: string): string {
  const [ivHex, encHex] = ciphertext.split(':');
  if (!ivHex || !encHex) throw new Error('Invalid ciphertext format');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * TypeORM column transformer for AES-256-CBC encryption at rest.
 * Applied to all sensitive persisted business data columns.
 * Key is derived from ENCRYPTION_KEY env var (required, no fallback).
 *
 * Encrypted fields inventory:
 * - lab_samples.patient_identifier, lab_samples.notes
 * - lab_results.text_value
 * - vendors.contact_name, vendors.email, vendors.phone
 * - purchase_requests.justification
 * - learning_plans.description
 * - deliverables.description
 * - purchase_orders.notes
 * - projects.description
 */
export const aesTransformer = {
  to(value: string | null | undefined): string | null {
    if (value == null || value === '') return null;
    return encrypt(value);
  },
  from(value: string | null | undefined): string | null {
    if (value == null || value === '') return null;
    try {
      return decrypt(value);
    } catch {
      // Return raw value if decryption fails (e.g., unencrypted legacy data)
      return value ?? null;
    }
  },
};
