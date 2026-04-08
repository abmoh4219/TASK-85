import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { RFQLine } from './rfq-line.entity';
import { Vendor } from './vendor.entity';
import { aesTransformer } from '../../common/transformers/aes.transformer';

@Entity('vendor_quotes')
export class VendorQuote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'rfq_line_id' })
  rfqLineId: string;

  @ManyToOne(() => RFQLine, (line) => line.vendorQuotes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rfq_line_id' })
  rfqLine: RFQLine;

  @Column({ name: 'vendor_id' })
  vendorId: string;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendor_id' })
  vendor: Vendor;

  @Column({ name: 'unit_price', type: 'decimal', precision: 12, scale: 4 })
  unitPrice: number;

  @Column({ name: 'lead_time_days', type: 'int', nullable: true })
  leadTimeDays: number | null;

  @Column({ name: 'valid_until', type: 'timestamptz', nullable: true })
  validUntil: Date | null;

  @Column({ name: 'is_selected', default: false })
  isSelected: boolean;

  @Column({ type: 'text', nullable: true, transformer: aesTransformer })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
