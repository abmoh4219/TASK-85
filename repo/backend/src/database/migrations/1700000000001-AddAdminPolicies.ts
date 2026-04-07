import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminPolicies1700000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS admin_policies (
        id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        key character varying(100) UNIQUE NOT NULL,
        value jsonb NOT NULL DEFAULT '{}',
        description text,
        updated_by_id uuid,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS admin_policies`);
  }
}
