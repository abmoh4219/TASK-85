import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn,
} from 'typeorm';
import { POReceiptLine } from './po-receipt-line.entity';
import { aesTransformer } from '../../common/transformers/aes.transformer';

export enum ReceiptStatus {
  PENDING = 'pending',
  INSPECTING = 'inspecting',
  PASSED = 'passed',
  FAILED = 'failed',
}

@Entity('po_receipts')
export class POReceipt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'purchase_order_id' })
  purchaseOrderId: string;

  @Column({ name: 'received_by_id' })
  receivedById: string;

  @Column({ type: 'enum', enum: ReceiptStatus, default: ReceiptStatus.PENDING })
  status: ReceiptStatus;

  @Column({ name: 'received_at', type: 'timestamptz', default: () => 'NOW()' })
  receivedAt: Date;

  @Column({ type: 'text', nullable: true, transformer: aesTransformer })
  notes: string | null;

  @OneToMany(() => POReceiptLine, (line) => line.receipt, { cascade: true })
  lines: POReceiptLine[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
