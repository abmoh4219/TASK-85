import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { ItemCategory } from './item-category.entity';

@Entity('items')
export class Item {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Column({ name: 'sku', length: 100, unique: true })
  sku: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'unit_of_measure', length: 50, default: 'each' })
  unitOfMeasure: string;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string | null;

  @ManyToOne(() => ItemCategory, (cat) => cat.items, { nullable: true })
  @JoinColumn({ name: 'category_id' })
  category: ItemCategory | null;

  @Column({ name: 'safety_stock_level', type: 'decimal', precision: 12, scale: 4, default: 0 })
  safetyStockLevel: number;

  @Column({ name: 'min_level', type: 'decimal', precision: 12, scale: 4, default: 0 })
  minLevel: number;

  @Column({ name: 'max_level', type: 'decimal', precision: 12, scale: 4, default: 0 })
  maxLevel: number;

  @Column({ name: 'lead_time_days', type: 'int', default: 7 })
  leadTimeDays: number;

  @Column({ name: 'replenishment_buffer_days', type: 'int', default: 14 })
  replenishmentBufferDays: number;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
