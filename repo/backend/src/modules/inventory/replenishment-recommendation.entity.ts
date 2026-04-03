import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Item } from './item.entity';

export enum RecommendationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DISMISSED = 'dismissed',
}

@Entity('replenishment_recommendations')
export class ReplenishmentRecommendation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'item_id' })
  itemId: string;

  @ManyToOne(() => Item)
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({ name: 'recommended_quantity', type: 'decimal', precision: 12, scale: 4 })
  recommendedQuantity: number;

  @Column({ name: 'lead_time_days', type: 'int' })
  leadTimeDays: number;

  @Column({ name: 'buffer_days', type: 'int', default: 14 })
  bufferDays: number;

  @Column({ name: 'avg_daily_usage', type: 'decimal', precision: 12, scale: 6 })
  avgDailyUsage: number;

  @Column({ type: 'enum', enum: RecommendationStatus, default: RecommendationStatus.PENDING })
  status: RecommendationStatus;

  @Column({ name: 'generated_pr_id', type: 'uuid', nullable: true })
  generatedPrId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
