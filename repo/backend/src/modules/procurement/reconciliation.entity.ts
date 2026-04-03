import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { PurchaseOrder } from './purchase-order.entity';

export enum ReconciliationStatus {
  PENDING = 'pending',
  MATCHED = 'matched',
  DISCREPANCY = 'discrepancy',
  RESOLVED = 'resolved',
}

@Entity('reconciliations')
export class Reconciliation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'purchase_order_id' })
  purchaseOrderId: string;

  @ManyToOne(() => PurchaseOrder)
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder: PurchaseOrder;

  @Column({ name: 'reconciled_by_id' })
  reconciledById: string;

  @Column({ type: 'enum', enum: ReconciliationStatus, default: ReconciliationStatus.PENDING })
  status: ReconciliationStatus;

  @Column({ type: 'jsonb', nullable: true })
  discrepancies: Record<string, unknown>[] | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
