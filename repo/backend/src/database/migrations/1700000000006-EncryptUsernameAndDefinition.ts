import { MigrationInterface, QueryRunner } from 'typeorm';

export class EncryptUsernameAndDefinition1700000000006 implements MigrationInterface {
  name = 'EncryptUsernameAndDefinition1700000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add username_hash column for blind-index lookups (HMAC-SHA256)
    await queryRunner.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS username_hash VARCHAR(64)`,
    );

    // 2. Widen username column to accommodate AES-encrypted ciphertext
    await queryRunner.query(
      `ALTER TABLE users ALTER COLUMN username TYPE VARCHAR(512)`,
    );

    // 3. Drop old unique constraint on username, add unique on username_hash
    //    (handle case where constraint may or may not exist)
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE users DROP CONSTRAINT IF EXISTS "UQ_fe0bb3f6520ee0469504521e710";
      EXCEPTION WHEN undefined_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;
      EXCEPTION WHEN undefined_object THEN NULL; END $$
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_username_hash"
        ON users (username_hash) WHERE deleted_at IS NULL
    `);

    // 4. Change rule_versions.definition from jsonb to text for AES encryption
    await queryRunner.query(
      `ALTER TABLE rule_versions ALTER COLUMN definition TYPE TEXT USING definition::TEXT`,
    );

    // 5. Widen definition column for encrypted ciphertext
    await queryRunner.query(
      `ALTER TABLE rule_versions ALTER COLUMN definition TYPE VARCHAR(8192)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse: definition back to jsonb
    await queryRunner.query(
      `ALTER TABLE rule_versions ALTER COLUMN definition TYPE JSONB USING definition::JSONB`,
    );

    // Reverse: drop username_hash index and column
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_username_hash"`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS username_hash`);
    await queryRunner.query(`ALTER TABLE users ALTER COLUMN username TYPE VARCHAR(100)`);
    await queryRunner.query(
      `ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username)`,
    );
  }
}
