import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Documents the AES-256-CBC at-rest encryption strategy in the database schema.
 * All text/narrative business data columns use application-layer AES-256-CBC
 * encryption via TypeORM column transformers. Values are stored as "iv:ciphertext"
 * hex strings. This migration adds schema comments for auditability.
 */
export class DocumentEncryption1700000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const encryptedColumns = [
      ['lab_samples', 'patient_identifier'],
      ['lab_samples', 'notes'],
      ['lab_results', 'text_value'],
      ['lab_results', 'notes'],
      ['lab_reports', 'summary'],
      ['lab_report_versions', 'summary'],
      ['lab_report_versions', 'change_reason'],
      ['vendors', 'contact_name'],
      ['vendors', 'email'],
      ['vendors', 'phone'],
      ['purchase_requests', 'justification'],
      ['purchase_request_items', 'notes'],
      ['purchase_orders', 'notes'],
      ['vendor_quotes', 'notes'],
      ['po_receipts', 'notes'],
      ['reconciliations', 'notes'],
      ['items', 'description'],
      ['item_categories', 'description'],
      ['alerts', 'message'],
      ['stock_movements', 'notes'],
      ['learning_plans', 'description'],
      ['learning_goals', 'description'],
      ['learning_plan_lifecycle', 'reason'],
      ['study_sessions', 'notes'],
      ['projects', 'description'],
      ['project_tasks', 'description'],
      ['milestones', 'description'],
      ['deliverables', 'description'],
      ['acceptance_scores', 'feedback'],
      ['business_rules', 'description'],
      ['rollout_feedback', 'feedback'],
      ['anomaly_events', 'description'],
      ['notifications', 'message'],
    ];

    for (const [table, column] of encryptedColumns) {
      await queryRunner.query(
        `COMMENT ON COLUMN "${table}"."${column}" IS 'AES-256-CBC encrypted at application layer (iv:ciphertext hex format)'`,
      ).catch(() => { /* table/column may not exist in test DB — skip */ });
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Comments are informational — no rollback needed
  }
}
