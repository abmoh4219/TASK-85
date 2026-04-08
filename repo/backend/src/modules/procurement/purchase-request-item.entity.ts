import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { PurchaseRequest } from './purchase-request.entity';
import { Item } from '../inventory/item.entity';
import { aesTransformer } from '../../common/transformers/aes.transformer';

@Entity('purchase_request_items')
export class PurchaseRequestItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'purchase_request_id' })
  purchaseRequestId: string;

  @ManyToOne(() => PurchaseRequest, (pr) => pr.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_request_id' })
  purchaseRequest: PurchaseRequest;

  @Column({ name: 'item_id' })
  itemId: string;

  @ManyToOne(() => Item)
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({ name: 'substitute_item_id', type: 'uuid', nullable: true })
  substituteItemId: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 4 })
  quantity: number;

  @Column({ name: 'unit_of_measure', length: 512, transformer: aesTransformer })
  unitOfMeasure: string;

  @Column({ type: 'text', nullable: true, transformer: aesTransformer })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
