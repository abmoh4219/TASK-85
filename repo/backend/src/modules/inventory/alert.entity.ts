import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { Item } from './item.entity';
import { aesTransformer } from '../../common/transformers/aes.transformer';

export enum AlertType {
  SAFETY_STOCK = 'safety_stock',
  MIN_MAX = 'min_max',
  NEAR_EXPIRATION = 'near_expiration',
  ABNORMAL_CONSUMPTION = 'abnormal_consumption',
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum AlertStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
}

@Entity('alerts')
@Index(['itemId', 'type', 'status'])
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'item_id' })
  itemId: string;

  @ManyToOne(() => Item)
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({ type: 'enum', enum: AlertType })
  type: AlertType;

  @Column({ type: 'enum', enum: AlertSeverity, default: AlertSeverity.MEDIUM })
  severity: AlertSeverity;

  @Column({ type: 'enum', enum: AlertStatus, default: AlertStatus.ACTIVE })
  status: AlertStatus;

  @Column({ type: 'text', transformer: aesTransformer })
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ name: 'acknowledged_by_id', type: 'uuid', nullable: true })
  acknowledgedById: string | null;

  @Column({ name: 'acknowledged_at', type: 'timestamptz', nullable: true })
  acknowledgedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
