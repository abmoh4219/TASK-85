import { MigrationInterface, QueryRunner } from 'typeorm';

export class WidenEncryptedColumns1700000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Widen columns that now store AES-encrypted values (iv:hex format, ~100+ chars)
    await queryRunner.query(`ALTER TABLE vendors ALTER COLUMN contact_name TYPE varchar(512)`);
    await queryRunner.query(`ALTER TABLE vendors ALTER COLUMN email TYPE varchar(512)`);
    await queryRunner.query(`ALTER TABLE vendors ALTER COLUMN phone TYPE varchar(512)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE vendors ALTER COLUMN contact_name TYPE varchar(200)`);
    await queryRunner.query(`ALTER TABLE vendors ALTER COLUMN email TYPE varchar(200)`);
    await queryRunner.query(`ALTER TABLE vendors ALTER COLUMN phone TYPE varchar(50)`);
  }
}
