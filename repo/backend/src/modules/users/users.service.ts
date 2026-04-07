import {
  Injectable, NotFoundException, ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from './user.entity';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  async getAll(): Promise<User[]> {
    return this.repo.find({ order: { createdAt: 'ASC' } });
  }

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.repo.findOne({ where: { username: dto.username } });
    if (existing) throw new ConflictException('Username already taken');
    const hash = await bcrypt.hash(dto.password, 12);
    const user = this.repo.create({ username: dto.username, passwordHash: hash, role: dto.role });
    return this.repo.save(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (dto.username !== undefined) user.username = dto.username;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    return this.repo.save(user);
  }

  async deactivate(id: string): Promise<User> {
    return this.update(id, { isActive: false });
  }
}
