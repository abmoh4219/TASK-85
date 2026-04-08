import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { LearningGoal } from './learning-goal.entity';
import { aesTransformer } from '../../common/transformers/aes.transformer';

@Entity('study_sessions')
export class StudySession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'goal_id' })
  goalId: string;

  @ManyToOne(() => LearningGoal, (g) => g.studySessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'goal_id' })
  goal: LearningGoal;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'duration_minutes', type: 'int', nullable: true })
  durationMinutes: number | null;

  @Column({ type: 'text', nullable: true, transformer: aesTransformer })
  notes: string | null;

  @Column({ name: 'session_date', type: 'timestamptz', default: () => 'NOW()' })
  sessionDate: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
