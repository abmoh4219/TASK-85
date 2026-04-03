import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { BusinessRule } from './business-rule.entity';

@Entity('rule_versions')
export class RuleVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'rule_id' })
  ruleId: string;

  @ManyToOne(() => BusinessRule, (r) => r.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rule_id' })
  rule: BusinessRule;

  @Column({ name: 'version_number', type: 'int' })
  versionNumber: number;

  @Column({ type: 'jsonb' })
  definition: Record<string, unknown>;

  @Column({ name: 'change_summary', type: 'text', nullable: true })
  changeSummary: string | null;

  @Column({ name: 'created_by_id' })
  createdById: string;

  @Column({ name: 'activated_at', type: 'timestamptz', nullable: true })
  activatedAt: Date | null;

  @Column({ name: 'rolled_back_at', type: 'timestamptz', nullable: true })
  rolledBackAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
