import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn,
} from 'typeorm';
import { RFQLine } from './rfq-line.entity';

export enum RFQStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  QUOTED = 'quoted',
  AWARDED = 'awarded',
  CANCELLED = 'cancelled',
}

@Entity('rfqs')
export class RFQ {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'rfq_number', unique: true })
  rfqNumber: string;

  @Column({ name: 'purchase_request_id' })
  purchaseRequestId: string;

  @Column({ name: 'created_by_id' })
  createdById: string;

  @Column({ type: 'enum', enum: RFQStatus, default: RFQStatus.DRAFT })
  status: RFQStatus;

  @Column({ name: 'due_date', type: 'timestamptz', nullable: true })
  dueDate: Date | null;

  @OneToMany(() => RFQLine, (line) => line.rfq, { cascade: true })
  lines: RFQLine[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
