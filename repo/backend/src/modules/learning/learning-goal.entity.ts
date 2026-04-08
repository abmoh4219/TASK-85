import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, OneToMany,
} from 'typeorm';
import { LearningPlan } from './learning-plan.entity';
import { StudySession } from './study-session.entity';
import { aesTransformer } from '../../common/transformers/aes.transformer';

export enum GoalPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

@Entity('learning_goals')
export class LearningGoal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'plan_id' })
  planId: string;

  @ManyToOne(() => LearningPlan, (p) => p.goals, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'plan_id' })
  plan: LearningPlan;

  @Column({ length: 512, transformer: aesTransformer })
  title: string;

  @Column({ type: 'text', nullable: true, transformer: aesTransformer })
  description: string | null;

  @Column({ type: 'enum', enum: GoalPriority, default: GoalPriority.MEDIUM })
  priority: GoalPriority;

  @Column({ type: 'simple-array', nullable: true })
  tags: string[] | null;

  @Column({ name: 'study_frequency_rule', type: 'varchar', length: 512, nullable: true, transformer: aesTransformer })
  studyFrequencyRule: string | null;

  @Column({ name: 'sessions_per_week', type: 'int', nullable: true })
  sessionsPerWeek: number | null;

  @OneToMany(() => StudySession, (s) => s.goal, { cascade: true })
  studySessions: StudySession[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
