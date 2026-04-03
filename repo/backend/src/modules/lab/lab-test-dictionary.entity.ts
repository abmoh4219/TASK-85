import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn, OneToMany,
} from 'typeorm';
import { ReferenceRange } from './reference-range.entity';

@Entity('lab_test_dictionaries')
export class LabTestDictionary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Column({ name: 'test_code', length: 50, unique: true })
  testCode: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'sample_type', type: 'varchar', length: 100, nullable: true })
  sampleType: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  unit: string | null;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => ReferenceRange, (rr) => rr.test, { cascade: true })
  referenceRanges: ReferenceRange[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
