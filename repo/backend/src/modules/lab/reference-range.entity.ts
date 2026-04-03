import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { LabTestDictionary } from './lab-test-dictionary.entity';

@Entity('reference_ranges')
export class ReferenceRange {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'test_id' })
  testId: string;

  @ManyToOne(() => LabTestDictionary, (t) => t.referenceRanges, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'test_id' })
  test: LabTestDictionary;

  @Column({ type: 'varchar', length: 100, nullable: true })
  population: string | null;

  @Column({ name: 'min_value', type: 'decimal', precision: 12, scale: 4, nullable: true })
  minValue: number | null;

  @Column({ name: 'max_value', type: 'decimal', precision: 12, scale: 4, nullable: true })
  maxValue: number | null;

  @Column({ name: 'critical_low', type: 'decimal', precision: 12, scale: 4, nullable: true })
  criticalLow: number | null;

  @Column({ name: 'critical_high', type: 'decimal', precision: 12, scale: 4, nullable: true })
  criticalHigh: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
