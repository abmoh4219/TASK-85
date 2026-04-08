import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Widen all text/varchar columns that now store AES-256-CBC encrypted values.
 * Encrypted ciphertext in iv:hex format requires ~100+ chars even for short values.
 */
export class WidenAllEncryptedColumns1700000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const columns: [string, string][] = [
      // Items/inventory
      ['items', 'name'],
      ['items', 'unit_of_measure'],
      ['item_categories', 'description'],
      ['stock_movements', 'reference_type'],
      ['stock_movements', 'notes'],
      // Learning
      ['learning_plans', 'title'],
      ['learning_plans', 'target_role'],
      ['learning_goals', 'title'],
      ['learning_goals', 'study_frequency_rule'],
      ['learning_plan_lifecycle', 'reason'],
      ['study_sessions', 'notes'],
      // Lab
      ['lab_test_dictionaries', 'name'],
      ['lab_test_dictionaries', 'description'],
      ['lab_test_dictionaries', 'sample_type'],
      ['lab_test_dictionaries', 'unit'],
      ['reference_ranges', 'population'],
      ['lab_samples', 'sample_type'],
      ['lab_reports', 'summary'],
      ['lab_report_versions', 'summary'],
      ['lab_report_versions', 'change_reason'],
      // Procurement
      ['rfq_lines', 'unit_of_measure'],
      ['po_lines', 'unit_of_measure'],
      ['put_aways', 'location'],
      ['po_receipt_lines', 'inspection_notes'],
      ['po_receipt_lines', 'lot_number'],
      ['purchase_request_items', 'unit_of_measure'],
      ['vendor_quotes', 'notes'],
      ['po_receipts', 'notes'],
      // Projects
      ['projects', 'title'],
      ['project_tasks', 'title'],
      ['project_tasks', 'description'],
      ['milestones', 'title'],
      ['milestones', 'description'],
      ['deliverables', 'title'],
      ['deliverables', 'file_url'],
      // Rules
      ['business_rules', 'name'],
      ['business_rules', 'description'],
      ['rule_versions', 'change_summary'],
      ['rollout_feedback', 'feedback'],
      // Notifications
      ['notifications', 'title'],
      ['notifications', 'reference_type'],
      ['anomaly_events', 'ip_address'],
      ['anomaly_events', 'request_path'],
      // Admin
      ['audit_logs', 'action'],
      ['audit_logs', 'entity_type'],
      ['audit_logs', 'ip'],
    ];

    for (const [table, column] of columns) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE varchar(512)`,
      ).catch(() => { /* column may already be text or not exist */ });
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Not reversible without data loss
  }
}
