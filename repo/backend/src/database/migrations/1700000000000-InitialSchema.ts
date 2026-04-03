import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable uuid-ossp extension first (required for uuid_generate_v4())
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // ── Enum types ──────────────────────────────────────────────────────────

    await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('admin','supervisor','hr','employee')`);
    await queryRunner.query(`CREATE TYPE "public"."purchase_requests_status_enum" AS ENUM('draft','submitted','approved','rejected','converted','cancelled')`);
    await queryRunner.query(`CREATE TYPE "public"."rfqs_status_enum" AS ENUM('draft','sent','quoted','awarded','cancelled')`);
    await queryRunner.query(`CREATE TYPE "public"."purchase_orders_status_enum" AS ENUM('draft','approved','sent','partially_received','received','cancelled')`);
    await queryRunner.query(`CREATE TYPE "public"."po_receipts_status_enum" AS ENUM('pending','inspecting','passed','failed')`);
    await queryRunner.query(`CREATE TYPE "public"."po_receipt_lines_inspection_result_enum" AS ENUM('pending','passed','failed')`);
    await queryRunner.query(`CREATE TYPE "public"."reconciliations_status_enum" AS ENUM('pending','matched','discrepancy','resolved')`);
    await queryRunner.query(`CREATE TYPE "public"."stock_movements_type_enum" AS ENUM('receipt','issue','adjustment','return','transfer')`);
    await queryRunner.query(`CREATE TYPE "public"."alerts_type_enum" AS ENUM('safety_stock','min_max','near_expiration','abnormal_consumption')`);
    await queryRunner.query(`CREATE TYPE "public"."alerts_severity_enum" AS ENUM('low','medium','high','critical')`);
    await queryRunner.query(`CREATE TYPE "public"."alerts_status_enum" AS ENUM('active','acknowledged','resolved')`);
    await queryRunner.query(`CREATE TYPE "public"."replenishment_recommendations_status_enum" AS ENUM('pending','accepted','dismissed')`);
    await queryRunner.query(`CREATE TYPE "public"."recommendation_feedback_type_enum" AS ENUM('impression','click')`);
    await queryRunner.query(`CREATE TYPE "public"."lab_samples_status_enum" AS ENUM('submitted','in_progress','reported','archived')`);
    await queryRunner.query(`CREATE TYPE "public"."lab_reports_status_enum" AS ENUM('draft','final','archived')`);
    await queryRunner.query(`CREATE TYPE "public"."projects_status_enum" AS ENUM('initiation','change','inspection','final_acceptance','archive')`);
    await queryRunner.query(`CREATE TYPE "public"."project_tasks_status_enum" AS ENUM('pending','in_progress','submitted','approved','rejected')`);
    await queryRunner.query(`CREATE TYPE "public"."learning_plans_status_enum" AS ENUM('not_started','active','paused','completed','archived')`);
    await queryRunner.query(`CREATE TYPE "public"."learning_goals_priority_enum" AS ENUM('low','medium','high')`);
    await queryRunner.query(`CREATE TYPE "public"."business_rules_status_enum" AS ENUM('draft','staged','active','inactive')`);
    await queryRunner.query(`CREATE TYPE "public"."business_rules_category_enum" AS ENUM('procurement_threshold','cancellation','pricing','parsing','inventory','custom')`);
    await queryRunner.query(`CREATE TYPE "public"."rule_rollouts_status_enum" AS ENUM('pending','in_progress','completed','rolled_back')`);
    await queryRunner.query(`CREATE TYPE "public"."notifications_type_enum" AS ENUM('alert','approval_needed','status_change','system')`);
    await queryRunner.query(`CREATE TYPE "public"."anomaly_events_type_enum" AS ENUM('rate_limit_exceeded','unusual_access_pattern','repeated_failed_login','privilege_escalation_attempt','bulk_data_export','after_hours_access','suspicious_query')`);
    await queryRunner.query(`CREATE TYPE "public"."anomaly_events_status_enum" AS ENUM('pending','reviewed','dismissed','escalated')`);

    // ── Core tables ──────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "username" character varying(100) NOT NULL,
        "password_hash" character varying NOT NULL,
        "role" "public"."users_role_enum" NOT NULL DEFAULT 'employee',
        "is_active" boolean NOT NULL DEFAULT true,
        "last_login_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_users_username" UNIQUE ("username"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "token_hash" character varying NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_refresh_tokens" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_refresh_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`);

    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid,
        "action" character varying(100) NOT NULL,
        "entity_type" character varying(100) NOT NULL,
        "entity_id" uuid,
        "before" jsonb,
        "after" jsonb,
        "ip" character varying(45),
        "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_entity" ON "audit_logs" ("entity_type", "entity_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_user" ON "audit_logs" ("user_id")`);

    // ── Catalog tables ───────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "vendors" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(200) NOT NULL,
        "contact_name" character varying(200),
        "email" character varying(200),
        "phone" character varying(50),
        "address" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_vendors" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "item_categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(150) NOT NULL,
        "description" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_item_categories_name" UNIQUE ("name"),
        CONSTRAINT "PK_item_categories" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(200) NOT NULL,
        "sku" character varying(100) NOT NULL,
        "description" text,
        "unit_of_measure" character varying(50) NOT NULL DEFAULT 'each',
        "category_id" uuid,
        "safety_stock_level" numeric(12,4) NOT NULL DEFAULT 0,
        "min_level" numeric(12,4) NOT NULL DEFAULT 0,
        "max_level" numeric(12,4) NOT NULL DEFAULT 0,
        "lead_time_days" integer NOT NULL DEFAULT 7,
        "replenishment_buffer_days" integer NOT NULL DEFAULT 14,
        "expires_at" TIMESTAMP WITH TIME ZONE,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_items_sku" UNIQUE ("sku"),
        CONSTRAINT "PK_items" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`ALTER TABLE "items" ADD CONSTRAINT "FK_items_category" FOREIGN KEY ("category_id") REFERENCES "item_categories"("id") ON DELETE SET NULL`);

    // ── Procurement tables ───────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "purchase_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "request_number" character varying NOT NULL,
        "requester_id" uuid NOT NULL,
        "status" "public"."purchase_requests_status_enum" NOT NULL DEFAULT 'draft',
        "justification" text,
        "approved_by_id" uuid,
        "approved_at" TIMESTAMP WITH TIME ZONE,
        "is_auto_generated" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_purchase_requests_number" UNIQUE ("request_number"),
        CONSTRAINT "PK_purchase_requests" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "purchase_request_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "purchase_request_id" uuid NOT NULL,
        "item_id" uuid NOT NULL,
        "substitute_item_id" uuid,
        "quantity" numeric(12,4) NOT NULL,
        "unit_of_measure" character varying(50) NOT NULL,
        "notes" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_purchase_request_items" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`ALTER TABLE "purchase_request_items" ADD CONSTRAINT "FK_pri_request" FOREIGN KEY ("purchase_request_id") REFERENCES "purchase_requests"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "purchase_request_items" ADD CONSTRAINT "FK_pri_item" FOREIGN KEY ("item_id") REFERENCES "items"("id")`);

    await queryRunner.query(`
      CREATE TABLE "rfqs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "rfq_number" character varying NOT NULL,
        "purchase_request_id" uuid NOT NULL,
        "created_by_id" uuid NOT NULL,
        "status" "public"."rfqs_status_enum" NOT NULL DEFAULT 'draft',
        "due_date" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_rfqs_number" UNIQUE ("rfq_number"),
        CONSTRAINT "PK_rfqs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "rfq_lines" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "rfq_id" uuid NOT NULL,
        "item_id" uuid NOT NULL,
        "quantity" numeric(12,4) NOT NULL,
        "unit_of_measure" character varying(50) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rfq_lines" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`ALTER TABLE "rfq_lines" ADD CONSTRAINT "FK_rfq_lines_rfq" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "rfq_lines" ADD CONSTRAINT "FK_rfq_lines_item" FOREIGN KEY ("item_id") REFERENCES "items"("id")`);

    await queryRunner.query(`
      CREATE TABLE "vendor_quotes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "rfq_line_id" uuid NOT NULL,
        "vendor_id" uuid NOT NULL,
        "unit_price" numeric(12,4) NOT NULL,
        "lead_time_days" integer,
        "valid_until" TIMESTAMP WITH TIME ZONE,
        "is_selected" boolean NOT NULL DEFAULT false,
        "notes" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vendor_quotes" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`ALTER TABLE "vendor_quotes" ADD CONSTRAINT "FK_vendor_quotes_rfq_line" FOREIGN KEY ("rfq_line_id") REFERENCES "rfq_lines"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "vendor_quotes" ADD CONSTRAINT "FK_vendor_quotes_vendor" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id")`);

    await queryRunner.query(`
      CREATE TABLE "purchase_orders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "po_number" character varying NOT NULL,
        "rfq_id" uuid,
        "vendor_id" uuid NOT NULL,
        "created_by_id" uuid NOT NULL,
        "approved_by_id" uuid,
        "approved_at" TIMESTAMP WITH TIME ZONE,
        "price_locked_until" TIMESTAMP WITH TIME ZONE,
        "status" "public"."purchase_orders_status_enum" NOT NULL DEFAULT 'draft',
        "total_amount" numeric(14,4) NOT NULL DEFAULT 0,
        "notes" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_purchase_orders_number" UNIQUE ("po_number"),
        CONSTRAINT "PK_purchase_orders" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "po_lines" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "purchase_order_id" uuid NOT NULL,
        "item_id" uuid NOT NULL,
        "quantity" numeric(12,4) NOT NULL,
        "received_quantity" numeric(12,4) NOT NULL DEFAULT 0,
        "unit_price" numeric(12,4) NOT NULL,
        "unit_of_measure" character varying(50) NOT NULL,
        "backorder_quantity" numeric(12,4) NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_po_lines" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`ALTER TABLE "po_lines" ADD CONSTRAINT "FK_po_lines_po" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "po_lines" ADD CONSTRAINT "FK_po_lines_item" FOREIGN KEY ("item_id") REFERENCES "items"("id")`);

    await queryRunner.query(`
      CREATE TABLE "po_receipts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "purchase_order_id" uuid NOT NULL,
        "received_by_id" uuid NOT NULL,
        "status" "public"."po_receipts_status_enum" NOT NULL DEFAULT 'pending',
        "received_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "notes" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_po_receipts" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "po_receipt_lines" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "receipt_id" uuid NOT NULL,
        "po_line_id" uuid NOT NULL,
        "received_quantity" numeric(12,4) NOT NULL,
        "inspection_result" "public"."po_receipt_lines_inspection_result_enum" NOT NULL DEFAULT 'pending',
        "inspection_notes" text,
        "lot_number" character varying(100),
        "expiry_date" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_po_receipt_lines" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`ALTER TABLE "po_receipt_lines" ADD CONSTRAINT "FK_po_receipt_lines_receipt" FOREIGN KEY ("receipt_id") REFERENCES "po_receipts"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "po_receipt_lines" ADD CONSTRAINT "FK_po_receipt_lines_po_line" FOREIGN KEY ("po_line_id") REFERENCES "po_lines"("id")`);

    await queryRunner.query(`
      CREATE TABLE "put_aways" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "receipt_line_id" uuid NOT NULL,
        "stored_by_id" uuid NOT NULL,
        "location" character varying(200),
        "quantity_stored" numeric(12,4) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_put_aways" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`ALTER TABLE "put_aways" ADD CONSTRAINT "FK_put_aways_receipt_line" FOREIGN KEY ("receipt_line_id") REFERENCES "po_receipt_lines"("id")`);

    await queryRunner.query(`
      CREATE TABLE "reconciliations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "purchase_order_id" uuid NOT NULL,
        "reconciled_by_id" uuid NOT NULL,
        "status" "public"."reconciliations_status_enum" NOT NULL DEFAULT 'pending',
        "discrepancies" jsonb,
        "notes" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reconciliations" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`ALTER TABLE "reconciliations" ADD CONSTRAINT "FK_reconciliations_po" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id")`);

    // ── Inventory tables ─────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "inventory_levels" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "item_id" uuid NOT NULL,
        "quantity_on_hand" numeric(12,4) NOT NULL DEFAULT 0,
        "quantity_reserved" numeric(12,4) NOT NULL DEFAULT 0,
        "quantity_on_order" numeric(12,4) NOT NULL DEFAULT 0,
        "last_updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_inventory_levels" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_inventory_levels_item" ON "inventory_levels" ("item_id")`);
    await queryRunner.query(`ALTER TABLE "inventory_levels" ADD CONSTRAINT "FK_inventory_levels_item" FOREIGN KEY ("item_id") REFERENCES "items"("id")`);

    await queryRunner.query(`
      CREATE TABLE "stock_movements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "item_id" uuid NOT NULL,
        "type" "public"."stock_movements_type_enum" NOT NULL,
        "quantity" numeric(12,4) NOT NULL,
        "quantity_before" numeric(12,4) NOT NULL,
        "quantity_after" numeric(12,4) NOT NULL,
        "reference_type" character varying(100),
        "reference_id" uuid,
        "performed_by_id" uuid,
        "notes" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stock_movements" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_stock_movements_item" ON "stock_movements" ("item_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_stock_movements_created" ON "stock_movements" ("created_at")`);
    await queryRunner.query(`ALTER TABLE "stock_movements" ADD CONSTRAINT "FK_stock_movements_item" FOREIGN KEY ("item_id") REFERENCES "items"("id")`);

    await queryRunner.query(`
      CREATE TABLE "alerts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "item_id" uuid NOT NULL,
        "type" "public"."alerts_type_enum" NOT NULL,
        "severity" "public"."alerts_severity_enum" NOT NULL DEFAULT 'medium',
        "status" "public"."alerts_status_enum" NOT NULL DEFAULT 'active',
        "message" text NOT NULL,
        "metadata" jsonb,
        "acknowledged_by_id" uuid,
        "acknowledged_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_alerts" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_alerts_item_type_status" ON "alerts" ("item_id", "type", "status")`);
    await queryRunner.query(`ALTER TABLE "alerts" ADD CONSTRAINT "FK_alerts_item" FOREIGN KEY ("item_id") REFERENCES "items"("id")`);

    await queryRunner.query(`
      CREATE TABLE "replenishment_recommendations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "item_id" uuid NOT NULL,
        "recommended_quantity" numeric(12,4) NOT NULL,
        "lead_time_days" integer NOT NULL,
        "buffer_days" integer NOT NULL DEFAULT 14,
        "avg_daily_usage" numeric(12,6) NOT NULL,
        "status" "public"."replenishment_recommendations_status_enum" NOT NULL DEFAULT 'pending',
        "generated_pr_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_replenishment_recommendations" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`ALTER TABLE "replenishment_recommendations" ADD CONSTRAINT "FK_replenishment_item" FOREIGN KEY ("item_id") REFERENCES "items"("id")`);

    await queryRunner.query(`
      CREATE TABLE "recommendation_feedback" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "recommendation_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "type" "public"."recommendation_feedback_type_enum" NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recommendation_feedback" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "FK_rec_feedback_recommendation" FOREIGN KEY ("recommendation_id") REFERENCES "replenishment_recommendations"("id")`);

    // ── Lab tables ───────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "lab_test_dictionaries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(200) NOT NULL,
        "test_code" character varying(50) NOT NULL,
        "description" text,
        "sample_type" character varying(100),
        "unit" character varying(50),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_lab_test_dictionaries_code" UNIQUE ("test_code"),
        CONSTRAINT "PK_lab_test_dictionaries" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "reference_ranges" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "test_id" uuid NOT NULL,
        "population" character varying(100),
        "min_value" numeric(12,4),
        "max_value" numeric(12,4),
        "critical_low" numeric(12,4),
        "critical_high" numeric(12,4),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reference_ranges" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`ALTER TABLE "reference_ranges" ADD CONSTRAINT "FK_reference_ranges_test" FOREIGN KEY ("test_id") REFERENCES "lab_test_dictionaries"("id") ON DELETE CASCADE`);

    await queryRunner.query(`
      CREATE TABLE "lab_samples" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sample_number" character varying NOT NULL,
        "submitted_by_id" uuid NOT NULL,
        "patient_identifier" character varying(200),
        "sample_type" character varying(100) NOT NULL,
        "collection_date" TIMESTAMP WITH TIME ZONE NOT NULL,
        "status" "public"."lab_samples_status_enum" NOT NULL DEFAULT 'submitted',
        "notes" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_lab_samples_number" UNIQUE ("sample_number"),
        CONSTRAINT "PK_lab_samples" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "lab_results" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sample_id" uuid NOT NULL,
        "test_id" uuid NOT NULL,
        "numeric_value" numeric(14,6),
        "text_value" text,
        "is_abnormal" boolean NOT NULL DEFAULT false,
        "is_critical" boolean NOT NULL DEFAULT false,
        "entered_by_id" uuid NOT NULL,
        "notes" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lab_results" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`ALTER TABLE "lab_results" ADD CONSTRAINT "FK_lab_results_sample" FOREIGN KEY ("sample_id") REFERENCES "lab_samples"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "lab_results" ADD CONSTRAINT "FK_lab_results_test" FOREIGN KEY ("test_id") REFERENCES "lab_test_dictionaries"("id")`);

    await queryRunner.query(`
      CREATE TABLE "lab_reports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sample_id" uuid NOT NULL,
        "report_number" character varying NOT NULL,
        "status" "public"."lab_reports_status_enum" NOT NULL DEFAULT 'draft',
        "summary" text,
        "created_by_id" uuid NOT NULL,
        "current_version" integer NOT NULL DEFAULT 1,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_lab_reports_number" UNIQUE ("report_number"),
        CONSTRAINT "PK_lab_reports" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "lab_report_versions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "report_id" uuid NOT NULL,
        "version_number" integer NOT NULL,
        "summary" text,
        "data" jsonb,
        "edited_by_id" uuid NOT NULL,
        "change_reason" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lab_report_versions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`ALTER TABLE "lab_report_versions" ADD CONSTRAINT "FK_lab_report_versions_report" FOREIGN KEY ("report_id") REFERENCES "lab_reports"("id") ON DELETE CASCADE`);

    // ── Projects tables ──────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "projects" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying(300) NOT NULL,
        "description" text,
        "owner_id" uuid NOT NULL,
        "status" "public"."projects_status_enum" NOT NULL DEFAULT 'initiation',
        "start_date" TIMESTAMP WITH TIME ZONE,
        "end_date" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_projects" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "project_tasks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "project_id" uuid NOT NULL,
        "title" character varying(300) NOT NULL,
        "description" text,
        "assigned_to_id" uuid,
        "created_by_id" uuid NOT NULL,
        "status" "public"."project_tasks_status_enum" NOT NULL DEFAULT 'pending',
        "due_date" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_project_tasks" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`ALTER TABLE "project_tasks" ADD CONSTRAINT "FK_project_tasks_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE`);

    await queryRunner.query(`
      CREATE TABLE "milestones" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "project_id" uuid NOT NULL,
        "title" character varying(300) NOT NULL,
        "description" text,
        "due_date" TIMESTAMP WITH TIME ZONE,
        "progress_percent" integer NOT NULL DEFAULT 0,
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_milestones" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`ALTER TABLE "milestones" ADD CONSTRAINT "FK_milestones_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE`);

    await queryRunner.query(`
      CREATE TABLE "deliverables" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "task_id" uuid NOT NULL,
        "submitted_by_id" uuid NOT NULL,
        "title" character varying(300) NOT NULL,
        "description" text,
        "file_url" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_deliverables" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`ALTER TABLE "deliverables" ADD CONSTRAINT "FK_deliverables_task" FOREIGN KEY ("task_id") REFERENCES "project_tasks"("id") ON DELETE CASCADE`);

    await queryRunner.query(`
      CREATE TABLE "acceptance_scores" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "project_id" uuid NOT NULL,
        "scored_by_id" uuid NOT NULL,
        "deliverable_id" uuid,
        "score" numeric(5,2) NOT NULL,
        "max_score" numeric(5,2) NOT NULL DEFAULT 100,
        "feedback" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_acceptance_scores" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`ALTER TABLE "acceptance_scores" ADD CONSTRAINT "FK_acceptance_scores_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id")`);

    // ── Learning tables ──────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "learning_plans" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying(300) NOT NULL,
        "description" text,
        "user_id" uuid NOT NULL,
        "created_by_id" uuid NOT NULL,
        "status" "public"."learning_plans_status_enum" NOT NULL DEFAULT 'not_started',
        "target_role" character varying(100),
        "start_date" TIMESTAMP WITH TIME ZONE,
        "end_date" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_learning_plans" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "learning_goals" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "plan_id" uuid NOT NULL,
        "title" character varying(300) NOT NULL,
        "description" text,
        "priority" "public"."learning_goals_priority_enum" NOT NULL DEFAULT 'medium',
        "tags" text,
        "study_frequency_rule" character varying(100),
        "sessions_per_week" integer,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_learning_goals" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`ALTER TABLE "learning_goals" ADD CONSTRAINT "FK_learning_goals_plan" FOREIGN KEY ("plan_id") REFERENCES "learning_plans"("id") ON DELETE CASCADE`);

    await queryRunner.query(`
      CREATE TABLE "study_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "goal_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "duration_minutes" integer,
        "notes" text,
        "session_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_study_sessions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`ALTER TABLE "study_sessions" ADD CONSTRAINT "FK_study_sessions_goal" FOREIGN KEY ("goal_id") REFERENCES "learning_goals"("id") ON DELETE CASCADE`);

    await queryRunner.query(`
      CREATE TABLE "learning_plan_lifecycle" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "plan_id" uuid NOT NULL,
        "from_status" "public"."learning_plans_status_enum",
        "to_status" "public"."learning_plans_status_enum" NOT NULL,
        "changed_by_id" uuid NOT NULL,
        "reason" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_learning_plan_lifecycle" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`ALTER TABLE "learning_plan_lifecycle" ADD CONSTRAINT "FK_lpl_plan" FOREIGN KEY ("plan_id") REFERENCES "learning_plans"("id") ON DELETE CASCADE`);

    // ── Rules Engine tables ──────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "business_rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(200) NOT NULL,
        "description" text,
        "category" "public"."business_rules_category_enum" NOT NULL DEFAULT 'custom',
        "status" "public"."business_rules_status_enum" NOT NULL DEFAULT 'draft',
        "current_version" integer NOT NULL DEFAULT 1,
        "is_ab_test" boolean NOT NULL DEFAULT false,
        "rollout_percentage" integer NOT NULL DEFAULT 100,
        "created_by_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_business_rules" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "rule_versions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "rule_id" uuid NOT NULL,
        "version_number" integer NOT NULL,
        "definition" jsonb NOT NULL,
        "change_summary" text,
        "created_by_id" uuid NOT NULL,
        "activated_at" TIMESTAMP WITH TIME ZONE,
        "rolled_back_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rule_versions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`ALTER TABLE "rule_versions" ADD CONSTRAINT "FK_rule_versions_rule" FOREIGN KEY ("rule_id") REFERENCES "business_rules"("id") ON DELETE CASCADE`);

    await queryRunner.query(`
      CREATE TABLE "rule_rollouts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "rule_id" uuid NOT NULL,
        "from_version" integer NOT NULL,
        "to_version" integer NOT NULL,
        "status" "public"."rule_rollouts_status_enum" NOT NULL DEFAULT 'pending',
        "initiated_by_id" uuid NOT NULL,
        "started_at" TIMESTAMP WITH TIME ZONE,
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "rollback_at" TIMESTAMP WITH TIME ZONE,
        "duration_ms" integer,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rule_rollouts" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`ALTER TABLE "rule_rollouts" ADD CONSTRAINT "FK_rule_rollouts_rule" FOREIGN KEY ("rule_id") REFERENCES "business_rules"("id")`);

    await queryRunner.query(`
      CREATE TABLE "rollout_feedback" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "rollout_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "feedback" text,
        "is_positive" boolean,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rollout_feedback" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`ALTER TABLE "rollout_feedback" ADD CONSTRAINT "FK_rollout_feedback_rollout" FOREIGN KEY ("rollout_id") REFERENCES "rule_rollouts"("id")`);

    // ── Notification tables ──────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "type" "public"."notifications_type_enum" NOT NULL,
        "title" character varying(300) NOT NULL,
        "message" text NOT NULL,
        "is_read" boolean NOT NULL DEFAULT false,
        "reference_type" character varying(100),
        "reference_id" uuid,
        "read_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_notifications_user_read" ON "notifications" ("user_id", "is_read")`);

    await queryRunner.query(`
      CREATE TABLE "anomaly_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid,
        "type" "public"."anomaly_events_type_enum" NOT NULL,
        "status" "public"."anomaly_events_status_enum" NOT NULL DEFAULT 'pending',
        "description" text NOT NULL,
        "ip_address" character varying(45),
        "request_path" character varying(500),
        "metadata" jsonb,
        "reviewed_by_id" uuid,
        "reviewed_at" TIMESTAMP WITH TIME ZONE,
        "review_notes" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_anomaly_events" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_anomaly_events_user_status" ON "anomaly_events" ("user_id", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_anomaly_events_status_created" ON "anomaly_events" ("status", "created_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse dependency order
    await queryRunner.query(`DROP TABLE IF EXISTS "anomaly_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rollout_feedback"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rule_rollouts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rule_versions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "business_rules"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "learning_plan_lifecycle"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "study_sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "learning_goals"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "learning_plans"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "acceptance_scores"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "deliverables"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "milestones"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project_tasks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "projects"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "lab_report_versions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "lab_reports"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "lab_results"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "lab_samples"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reference_ranges"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "lab_test_dictionaries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "recommendation_feedback"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "replenishment_recommendations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "alerts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_movements"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_levels"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reconciliations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "put_aways"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "po_receipt_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "po_receipts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "po_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "purchase_orders"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "vendor_quotes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rfq_lines"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rfqs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "purchase_request_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "purchase_requests"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "item_categories"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "vendors"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);

    // Drop enum types
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."anomaly_events_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."anomaly_events_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."notifications_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."rule_rollouts_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."business_rules_category_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."business_rules_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."learning_goals_priority_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."learning_plans_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."project_tasks_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."projects_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."lab_reports_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."lab_samples_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."recommendation_feedback_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."replenishment_recommendations_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."alerts_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."alerts_severity_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."alerts_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."stock_movements_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."reconciliations_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."po_receipt_lines_inspection_result_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."po_receipts_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."purchase_orders_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."rfqs_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."purchase_requests_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."users_role_enum"`);
  }
}
