import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
  OneToMany, ManyToOne, JoinColumn,
} from 'typeorm';
import { POLine } from './po-line.entity';

export enum POStatus {
  DRAFT = 'draft',
  APPROVED = 'approved',
  SENT = 'sent',
  PARTIALLY_RECEIVED = 'partially_received',
  RECEIVED = 'received',
  CANCELLED = 'cancelled',
}

@Entity('purchase_orders')
export class PurchaseOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'po_number', unique: true })
  poNumber: string;

  @Column({ name: 'rfq_id', type: 'uuid', nullable: true })
  rfqId: string | null;

  @Column({ name: 'vendor_id' })
  vendorId: string;

  @Column({ name: 'created_by_id' })
  createdById: string;

  @Column({ name: 'approved_by_id', type: 'uuid', nullable: true })
  approvedById: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'price_locked_until', type: 'timestamptz', nullable: true })
  priceLockedUntil: Date | null;

  @Column({ type: 'enum', enum: POStatus, default: POStatus.DRAFT })
  status: POStatus;

  @Column({ name: 'total_amount', type: 'decimal', precision: 14, scale: 4, default: 0 })
  totalAmount: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => POLine, (line) => line.purchaseOrder, { cascade: true })
  lines: POLine[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
