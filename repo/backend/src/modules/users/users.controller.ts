import {
  Controller, Get, Post, Patch, Param, Body, HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequireAction } from '../../common/decorators/require-action.decorator';
import { UserRole } from './user.entity';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Controller('admin/users')
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.HR)
  async getAll() {
    const users = await this.svc.getAll();
    // never return passwordHash
    const data = users.map(({ passwordHash: _ph, ...u }) => u);
    return { data };
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @RequireAction('admin:manage-users')
  async create(@Body() dto: CreateUserDto) {
    const user = await this.svc.create(dto);
    const { passwordHash: _ph, ...data } = user;
    return { data };
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @RequireAction('admin:manage-users')
  @HttpCode(HttpStatus.OK)
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    const user = await this.svc.update(id, dto);
    const { passwordHash: _ph, ...data } = user;
    return { data };
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.ADMIN)
  @RequireAction('admin:manage-users')
  @HttpCode(HttpStatus.OK)
  async deactivate(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.svc.deactivate(id);
    const { passwordHash: _ph, ...data } = user;
    return { data };
  }
}
