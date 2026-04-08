import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { POReceipt } from './po-receipt.entity';
import { POLine } from './po-line.entity';
import { aesTransformer } from '../../common/transformers/aes.transformer';

export enum InspectionResult {
  PENDING = 'pending',
  PASSED = 'passed',
  FAILED = 'failed',
}

@Entity('po_receipt_lines')
export class POReceiptLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'receipt_id' })
  receiptId: string;

  @ManyToOne(() => POReceipt, (r) => r.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'receipt_id' })
  receipt: POReceipt;

  @Column({ name: 'po_line_id' })
  poLineId: string;

  @ManyToOne(() => POLine)
  @JoinColumn({ name: 'po_line_id' })
  poLine: POLine;

  @Column({ name: 'received_quantity', type: 'decimal', precision: 12, scale: 4 })
  receivedQuantity: number;

  @Column({ name: 'inspection_result', type: 'enum', enum: InspectionResult, default: InspectionResult.PENDING })
  inspectionResult: InspectionResult;

  @Column({ name: 'inspection_notes', type: 'text', nullable: true, transformer: aesTransformer })
  inspectionNotes: string | null;

  @Column({ name: 'lot_number', type: 'varchar', length: 512, nullable: true, transformer: aesTransformer })
  lotNumber: string | null;

  @Column({ name: 'expiry_date', type: 'timestamptz', nullable: true })
  expiryDate: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
