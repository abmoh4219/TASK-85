import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { aesTransformer } from '../../common/transformers/aes.transformer';

export enum UserRole {
  ADMIN = 'admin',
  SUPERVISOR = 'supervisor',
  HR = 'hr',
  EMPLOYEE = 'employee',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Encrypted at rest. Lookups use username_hash (blind index). */
  @Column({ type: 'varchar', length: 512, transformer: aesTransformer })
  username: string;

  /** HMAC-SHA256 blind index for unique constraint and WHERE queries. */
  @Column({ name: 'username_hash', type: 'varchar', length: 64, unique: true, nullable: true })
  usernameHash: string | null;

  /**
   * Password stored as bcrypt hash (cost 12). Bcrypt is a one-way hash
   * intentionally used instead of reversible AES — it is the industry
   * standard for password storage and provides stronger protection than
   * reversible encryption (compromised key would expose all passwords).
   */
  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.EMPLOYEE })
  role: UserRole;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
