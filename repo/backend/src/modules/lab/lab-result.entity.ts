import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { LabSample } from './lab-sample.entity';
import { LabTestDictionary } from './lab-test-dictionary.entity';
import { aesTransformer } from '../../common/transformers/aes.transformer';

@Entity('lab_results')
export class LabResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sample_id' })
  sampleId: string;

  @ManyToOne(() => LabSample, (s) => s.results, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sample_id' })
  sample: LabSample;

  @Column({ name: 'test_id' })
  testId: string;

  @ManyToOne(() => LabTestDictionary)
  @JoinColumn({ name: 'test_id' })
  test: LabTestDictionary;

  @Column({ name: 'numeric_value', type: 'decimal', precision: 14, scale: 6, nullable: true })
  numericValue: number | null;

  @Column({ name: 'text_value', type: 'text', nullable: true, transformer: aesTransformer })
  textValue: string | null;

  @Column({ name: 'is_abnormal', default: false })
  isAbnormal: boolean;

  @Column({ name: 'is_critical', default: false })
  isCritical: boolean;

  @Column({ name: 'entered_by_id' })
  enteredById: string;

  @Column({ type: 'text', nullable: true, transformer: aesTransformer })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
