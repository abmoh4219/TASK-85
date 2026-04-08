import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { LabReport } from './lab-report.entity';
import { aesTransformer } from '../../common/transformers/aes.transformer';

@Entity('lab_report_versions')
export class LabReportVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'report_id' })
  reportId: string;

  @ManyToOne(() => LabReport, (r) => r.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'report_id' })
  report: LabReport;

  @Column({ name: 'version_number', type: 'int' })
  versionNumber: number;

  @Column({ type: 'text', nullable: true, transformer: aesTransformer })
  summary: string | null;

  @Column({ type: 'jsonb', nullable: true })
  data: Record<string, unknown> | null;

  @Column({ name: 'edited_by_id' })
  editedById: string;

  @Column({ name: 'change_reason', type: 'text', nullable: true, transformer: aesTransformer })
  changeReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
