import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn, OneToMany,
} from 'typeorm';
import { LabResult } from './lab-result.entity';
import { aesTransformer } from '../../common/transformers/aes.transformer';

export enum SampleStatus {
  SUBMITTED = 'submitted',
  IN_PROGRESS = 'in_progress',
  REPORTED = 'reported',
  ARCHIVED = 'archived',
}

@Entity('lab_samples')
export class LabSample {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sample_number', unique: true })
  sampleNumber: string;

  @Column({ name: 'submitted_by_id' })
  submittedById: string;

  @Column({ name: 'patient_identifier', type: 'varchar', length: 512, nullable: true, transformer: aesTransformer })
  patientIdentifier: string | null;

  @Column({ name: 'sample_type', length: 512, transformer: aesTransformer })
  sampleType: string;

  @Column({ name: 'collection_date', type: 'timestamptz' })
  collectionDate: Date;

  @Column({ type: 'enum', enum: SampleStatus, default: SampleStatus.SUBMITTED })
  status: SampleStatus;

  @Column({ type: 'text', nullable: true, transformer: aesTransformer })
  notes: string | null;

  @OneToMany(() => LabResult, (r) => r.sample, { cascade: true })
  results: LabResult[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
