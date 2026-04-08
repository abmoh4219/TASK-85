import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToMany,
} from 'typeorm';
import { Item } from './item.entity';
import { aesTransformer } from '../../common/transformers/aes.transformer';

@Entity('item_categories')
export class ItemCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150, unique: true })
  name: string;

  @Column({ type: 'text', nullable: true, transformer: aesTransformer })
  description: string | null;

  @OneToMany(() => Item, (item) => item.category)
  items: Item[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
