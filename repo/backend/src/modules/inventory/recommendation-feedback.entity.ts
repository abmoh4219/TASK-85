import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { ReplenishmentRecommendation } from './replenishment-recommendation.entity';

export enum FeedbackType {
  IMPRESSION = 'impression',
  CLICK = 'click',
}

@Entity('recommendation_feedback')
export class RecommendationFeedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'recommendation_id' })
  recommendationId: string;

  @ManyToOne(() => ReplenishmentRecommendation)
  @JoinColumn({ name: 'recommendation_id' })
  recommendation: ReplenishmentRecommendation;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'enum', enum: FeedbackType })
  type: FeedbackType;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
