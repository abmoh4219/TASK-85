import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

export enum AnomalyEventType {
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  UNUSUAL_ACCESS_PATTERN = 'unusual_access_pattern',
  REPEATED_FAILED_LOGIN = 'repeated_failed_login',
  PRIVILEGE_ESCALATION_ATTEMPT = 'privilege_escalation_attempt',
  BULK_DATA_EXPORT = 'bulk_data_export',
  AFTER_HOURS_ACCESS = 'after_hours_access',
  SUSPICIOUS_QUERY = 'suspicious_query',
}

export enum AnomalyEventStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
  DISMISSED = 'dismissed',
  ESCALATED = 'escalated',
}

@Entity('anomaly_events')
@Index(['userId', 'status'])
@Index(['status', 'createdAt'])
export class AnomalyEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'enum', enum: AnomalyEventType })
  type: AnomalyEventType;

  @Column({ type: 'enum', enum: AnomalyEventStatus, default: AnomalyEventStatus.PENDING })
  status: AnomalyEventStatus;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'request_path', type: 'varchar', length: 500, nullable: true })
  requestPath: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ name: 'reviewed_by_id', type: 'uuid', nullable: true })
  reviewedById: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ name: 'review_notes', type: 'text', nullable: true })
  reviewNotes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
