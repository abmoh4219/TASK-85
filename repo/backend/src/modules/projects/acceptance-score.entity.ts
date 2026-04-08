import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Project } from './project.entity';
import { aesTransformer } from '../../common/transformers/aes.transformer';

@Entity('acceptance_scores')
export class AcceptanceScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id' })
  projectId: string;

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'scored_by_id' })
  scoredById: string;

  @Column({ name: 'deliverable_id', type: 'uuid', nullable: true })
  deliverableId: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  score: number;

  @Column({ name: 'max_score', type: 'decimal', precision: 5, scale: 2, default: 100 })
  maxScore: number;

  @Column({ type: 'text', nullable: true, transformer: aesTransformer })
  feedback: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
