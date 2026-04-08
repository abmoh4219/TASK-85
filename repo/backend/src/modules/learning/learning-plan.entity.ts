import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn, OneToMany,
} from 'typeorm';
import { LearningGoal } from './learning-goal.entity';
import { aesTransformer } from '../../common/transformers/aes.transformer';

export enum LearningPlanStatus {
  NOT_STARTED = 'not_started',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

@Entity('learning_plans')
export class LearningPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 300 })
  title: string;

  @Column({ type: 'text', nullable: true, transformer: aesTransformer })
  description: string | null;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'created_by_id' })
  createdById: string;

  @Column({ type: 'enum', enum: LearningPlanStatus, default: LearningPlanStatus.NOT_STARTED })
  status: LearningPlanStatus;

  @Column({ name: 'target_role', type: 'varchar', length: 100, nullable: true })
  targetRole: string | null;

  @Column({ name: 'start_date', type: 'timestamptz', nullable: true })
  startDate: Date | null;

  @Column({ name: 'end_date', type: 'timestamptz', nullable: true })
  endDate: Date | null;

  @OneToMany(() => LearningGoal, (g) => g.plan, { cascade: true })
  goals: LearningGoal[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
