import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, UpdateDateColumn, CreateDateColumn, Index,
} from 'typeorm';
import { Item } from './item.entity';

@Entity('inventory_levels')
@Index(['itemId'], { unique: true })
export class InventoryLevel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'item_id' })
  itemId: string;

  @ManyToOne(() => Item)
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({ name: 'quantity_on_hand', type: 'decimal', precision: 12, scale: 4, default: 0 })
  quantityOnHand: number;

  @Column({ name: 'quantity_reserved', type: 'decimal', precision: 12, scale: 4, default: 0 })
  quantityReserved: number;

  @Column({ name: 'quantity_on_order', type: 'decimal', precision: 12, scale: 4, default: 0 })
  quantityOnOrder: number;

  @UpdateDateColumn({ name: 'last_updated_at', type: 'timestamptz' })
  lastUpdatedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
