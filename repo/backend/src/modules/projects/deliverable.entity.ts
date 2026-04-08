import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { ProjectTask } from './project-task.entity';
import { aesTransformer } from '../../common/transformers/aes.transformer';

@Entity('deliverables')
export class Deliverable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'task_id' })
  taskId: string;

  @ManyToOne(() => ProjectTask, (t) => t.deliverables, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: ProjectTask;

  @Column({ name: 'submitted_by_id' })
  submittedById: string;

  @Column({ length: 512, transformer: aesTransformer })
  title: string;

  @Column({ type: 'text', nullable: true, transformer: aesTransformer })
  description: string | null;

  @Column({ name: 'file_url', type: 'text', nullable: true, transformer: aesTransformer })
  fileUrl: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
