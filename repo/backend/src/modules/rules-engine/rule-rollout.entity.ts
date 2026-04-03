import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { BusinessRule } from './business-rule.entity';

export enum RolloutStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  ROLLED_BACK = 'rolled_back',
}

@Entity('rule_rollouts')
export class RuleRollout {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'rule_id' })
  ruleId: string;

  @ManyToOne(() => BusinessRule)
  @JoinColumn({ name: 'rule_id' })
  rule: BusinessRule;

  @Column({ name: 'from_version', type: 'int' })
  fromVersion: number;

  @Column({ name: 'to_version', type: 'int' })
  toVersion: number;

  @Column({ type: 'enum', enum: RolloutStatus, default: RolloutStatus.PENDING })
  status: RolloutStatus;

  @Column({ name: 'initiated_by_id' })
  initiatedById: string;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'rollback_at', type: 'timestamptz', nullable: true })
  rollbackAt: Date | null;

  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
