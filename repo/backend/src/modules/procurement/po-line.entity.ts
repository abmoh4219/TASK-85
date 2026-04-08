import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { PurchaseOrder } from './purchase-order.entity';
import { Item } from '../inventory/item.entity';
import { aesTransformer } from '../../common/transformers/aes.transformer';

@Entity('po_lines')
export class POLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'purchase_order_id' })
  purchaseOrderId: string;

  @ManyToOne(() => PurchaseOrder, (po) => po.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder: PurchaseOrder;

  @Column({ name: 'item_id' })
  itemId: string;

  @ManyToOne(() => Item)
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({ type: 'decimal', precision: 12, scale: 4 })
  quantity: number;

  @Column({ name: 'received_quantity', type: 'decimal', precision: 12, scale: 4, default: 0 })
  receivedQuantity: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 12, scale: 4 })
  unitPrice: number;

  @Column({ name: 'unit_of_measure', length: 512, transformer: aesTransformer })
  unitOfMeasure: string;

  @Column({ name: 'backorder_quantity', type: 'decimal', precision: 12, scale: 4, default: 0 })
  backorderQuantity: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
