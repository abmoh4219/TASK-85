import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { aesTransformer } from '../../common/transformers/aes.transformer';

@Entity('admin_policies')
export class AdminPolicy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 100 })
  key: string;

  @Column({ type: 'jsonb' })
  value: Record<string, unknown>;

  @Column({ type: 'text', nullable: true, transformer: aesTransformer })
  description: string | null;

  @Column({ name: 'updated_by_id', type: 'uuid', nullable: true })
  updatedById: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
