import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUsedNonces1700000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS used_nonces (
        id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
        nonce character varying(255) NOT NULL,
        user_id character varying(255),
        created_at timestamptz DEFAULT now() NOT NULL
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_used_nonces_nonce_user
        ON used_nonces (nonce, COALESCE(user_id, '__anon__'))
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_used_nonces_created_at ON used_nonces (created_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS used_nonces`);
  }
}
