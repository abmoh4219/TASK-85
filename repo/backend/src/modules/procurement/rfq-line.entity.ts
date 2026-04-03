import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, OneToMany, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { RFQ } from './rfq.entity';
import { Item } from '../inventory/item.entity';
import { VendorQuote } from './vendor-quote.entity';

@Entity('rfq_lines')
export class RFQLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'rfq_id' })
  rfqId: string;

  @ManyToOne(() => RFQ, (rfq) => rfq.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rfq_id' })
  rfq: RFQ;

  @Column({ name: 'item_id' })
  itemId: string;

  @ManyToOne(() => Item)
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({ type: 'decimal', precision: 12, scale: 4 })
  quantity: number;

  @Column({ name: 'unit_of_measure', length: 50 })
  unitOfMeasure: string;

  @OneToMany(() => VendorQuote, (q) => q.rfqLine, { cascade: true })
  vendorQuotes: VendorQuote[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
