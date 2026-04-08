import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn, OneToMany,
} from 'typeorm';
import { LabReportVersion } from './lab-report-version.entity';
import { aesTransformer } from '../../common/transformers/aes.transformer';

export enum ReportStatus {
  DRAFT = 'draft',
  FINAL = 'final',
  ARCHIVED = 'archived',
}

@Entity('lab_reports')
export class LabReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sample_id' })
  sampleId: string;

  @Column({ name: 'report_number', unique: true })
  reportNumber: string;

  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.DRAFT })
  status: ReportStatus;

  @Column({ type: 'text', nullable: true, transformer: aesTransformer })
  summary: string | null;

  @Column({ name: 'created_by_id' })
  createdById: string;

  @Column({ name: 'current_version', type: 'int', default: 1 })
  currentVersion: number;

  @OneToMany(() => LabReportVersion, (v) => v.report, { cascade: true })
  versions: LabReportVersion[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
