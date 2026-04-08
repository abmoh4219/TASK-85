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
 * Encryption scope: ALL persisted business data text/varchar columns are encrypted
 * at the application layer using this transformer. Only UUID foreign keys, enum
 * columns, numeric columns, boolean flags, timestamps, and unique-indexed
 * identifiers (sku, request_number, etc.) are excluded because they require
 * plaintext for database operations (joins, indexes, constraints).
 *
 * Column-level AES-256-CBC encrypted fields (55+ across all entities):
 *
 * Lab: patient_identifier, notes, sampleType (lab_samples); text_value, notes
 *   (lab_results); summary (lab_reports); summary, changeReason (lab_report_versions);
 *   name, description, sampleType, unit (lab_test_dictionaries); population (reference_ranges)
 * Procurement: name, contact_name, email, phone, address (vendors); justification
 *   (purchase_requests); notes, unitOfMeasure (purchase_request_items); notes
 *   (purchase_orders); notes (vendor_quotes); unitOfMeasure (rfq_lines);
 *   unitOfMeasure (po_lines); notes (po_receipts); inspectionNotes, lotNumber
 *   (po_receipt_lines); location (put_aways); notes (reconciliations)
 * Inventory: name, description, unitOfMeasure (items); description (item_categories);
 *   message (alerts); notes, referenceType (stock_movements)
 * Projects: title, description (projects); title, description (project_tasks);
 *   title, description (milestones); title, description, fileUrl (deliverables);
 *   feedback (acceptance_scores)
 * Learning: title, description, targetRole (learning_plans); title, description,
 *   studyFrequencyRule (learning_goals); reason (learning_plan_lifecycle);
 *   notes (study_sessions)
 * Rules: name, description (business_rules); changeSummary (rule_versions);
 *   feedback (rollout_feedback)
 * Notifications: title, message (notifications); description, reviewNotes,
 *   ipAddress, requestPath (anomaly_events)
 * Admin: action, entityType, ip (audit_logs); description (admin_policies)
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
