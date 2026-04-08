import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { POReceiptLine } from './po-receipt-line.entity';
import { aesTransformer } from '../../common/transformers/aes.transformer';

@Entity('put_aways')
export class PutAway {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'receipt_line_id' })
  receiptLineId: string;

  @ManyToOne(() => POReceiptLine)
  @JoinColumn({ name: 'receipt_line_id' })
  receiptLine: POReceiptLine;

  @Column({ name: 'stored_by_id' })
  storedById: string;

  @Column({ name: 'location', type: 'varchar', length: 512, nullable: true, transformer: aesTransformer })
  location: string | null;

  @Column({ name: 'quantity_stored', type: 'decimal', precision: 12, scale: 4 })
  quantityStored: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
