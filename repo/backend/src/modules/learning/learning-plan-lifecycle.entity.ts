import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { LearningPlan, LearningPlanStatus } from './learning-plan.entity';

@Entity('learning_plan_lifecycle')
export class LearningPlanLifecycle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plan_id' })
  planId: string;

  @ManyToOne(() => LearningPlan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan: LearningPlan;

  @Column({ name: 'from_status', type: 'enum', enum: LearningPlanStatus, nullable: true })
  fromStatus: LearningPlanStatus | null;

  @Column({ name: 'to_status', type: 'enum', enum: LearningPlanStatus })
  toStatus: LearningPlanStatus;

  @Column({ name: 'changed_by_id' })
  changedById: string;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
