import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, Index,
} from 'typeorm';
import { Item } from './item.entity';
import { aesTransformer } from '../../common/transformers/aes.transformer';

export enum MovementType {
  RECEIPT = 'receipt',
  ISSUE = 'issue',
  ADJUSTMENT = 'adjustment',
  RETURN = 'return',
  TRANSFER = 'transfer',
}

@Entity('stock_movements')
@Index(['itemId'])
@Index(['createdAt'])
export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'item_id' })
  itemId: string;

  @ManyToOne(() => Item)
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({ type: 'enum', enum: MovementType })
  type: MovementType;

  @Column({ type: 'decimal', precision: 12, scale: 4 })
  quantity: number;

  @Column({ name: 'quantity_before', type: 'decimal', precision: 12, scale: 4 })
  quantityBefore: number;

  @Column({ name: 'quantity_after', type: 'decimal', precision: 12, scale: 4 })
  quantityAfter: number;

  @Column({ name: 'reference_type', type: 'varchar', length: 512, nullable: true, transformer: aesTransformer })
  referenceType: string | null;

  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId: string | null;

  @Column({ name: 'performed_by_id', type: 'uuid', nullable: true })
  performedById: string | null;

  @Column({ type: 'text', nullable: true, transformer: aesTransformer })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
