import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn, OneToMany,
} from 'typeorm';
import { RuleVersion } from './rule-version.entity';

export enum RuleStatus {
  DRAFT = 'draft',
  STAGED = 'staged',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum RuleCategory {
  PROCUREMENT_THRESHOLD = 'procurement_threshold',
  CANCELLATION = 'cancellation',
  PRICING = 'pricing',
  PARSING = 'parsing',
  INVENTORY = 'inventory',
  CUSTOM = 'custom',
}

@Entity('business_rules')
export class BusinessRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: RuleCategory, default: RuleCategory.CUSTOM })
  category: RuleCategory;

  @Column({ type: 'enum', enum: RuleStatus, default: RuleStatus.DRAFT })
  status: RuleStatus;

  @Column({ name: 'current_version', type: 'int', default: 1 })
  currentVersion: number;

  @Column({ name: 'is_ab_test', default: false })
  isAbTest: boolean;

  @Column({ name: 'rollout_percentage', type: 'int', default: 100 })
  rolloutPercentage: number;

  @Column({ name: 'created_by_id' })
  createdById: string;

  @OneToMany(() => RuleVersion, (v) => v.rule, { cascade: true })
  versions: RuleVersion[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
