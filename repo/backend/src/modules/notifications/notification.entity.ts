import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { aesTransformer } from '../../common/transformers/aes.transformer';

export enum NotificationType {
  ALERT = 'alert',
  APPROVAL_NEEDED = 'approval_needed',
  STATUS_CHANGE = 'status_change',
  SYSTEM = 'system',
}

@Entity('notifications')
@Index(['userId', 'isRead'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ length: 512, transformer: aesTransformer })
  title: string;

  @Column({ type: 'text', transformer: aesTransformer })
  message: string;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @Column({ name: 'reference_type', type: 'varchar', length: 512, nullable: true, transformer: aesTransformer })
  referenceType: string | null;

  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId: string | null;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
