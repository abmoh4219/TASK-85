import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn, OneToMany,
} from 'typeorm';
import { ProjectTask } from './project-task.entity';
import { Milestone } from './milestone.entity';

export enum ProjectStatus {
  INITIATION = 'initiation',
  CHANGE = 'change',
  INSPECTION = 'inspection',
  FINAL_ACCEPTANCE = 'final_acceptance',
  ARCHIVE = 'archive',
}

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 300 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'owner_id' })
  ownerId: string;

  @Column({ type: 'enum', enum: ProjectStatus, default: ProjectStatus.INITIATION })
  status: ProjectStatus;

  @Column({ name: 'start_date', type: 'timestamptz', nullable: true })
  startDate: Date | null;

  @Column({ name: 'end_date', type: 'timestamptz', nullable: true })
  endDate: Date | null;

  @OneToMany(() => ProjectTask, (t) => t.project, { cascade: true })
  tasks: ProjectTask[];

  @OneToMany(() => Milestone, (m) => m.project, { cascade: true })
  milestones: Milestone[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
