import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
} from 'typeorm';
import { aesTransformer } from '../../common/transformers/aes.transformer';

@Entity('vendors')
export class Vendor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 512, transformer: aesTransformer })
  name: string;

  @Column({ name: 'contact_name', type: 'varchar', length: 512, nullable: true, transformer: aesTransformer })
  contactName: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true, transformer: aesTransformer })
  email: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true, transformer: aesTransformer })
  phone: string | null;

  @Column({ type: 'text', nullable: true, transformer: aesTransformer })
  address: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
