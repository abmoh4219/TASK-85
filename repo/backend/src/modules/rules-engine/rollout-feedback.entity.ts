import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { RuleRollout } from './rule-rollout.entity';

@Entity('rollout_feedback')
export class RolloutFeedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'rollout_id' })
  rolloutId: string;

  @ManyToOne(() => RuleRollout)
  @JoinColumn({ name: 'rollout_id' })
  rollout: RuleRollout;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'text', nullable: true })
  feedback: string | null;

  @Column({ name: 'is_positive', type: 'boolean', nullable: true })
  isPositive: boolean | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
