import {
  Controller, Get, Post, Patch, Param, Body, HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from './user.entity';
import { UsersService, CreateUserDto, UpdateUserDto } from './users.service';

@Controller('admin/users')
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Get()
  async getAll() {
    const users = await this.svc.getAll();
    // never return passwordHash
    const data = users.map(({ passwordHash: _ph, ...u }) => u);
    return { data };
  }

  @Post()
  async create(@Body() dto: CreateUserDto) {
    const user = await this.svc.create(dto);
    const { passwordHash: _ph, ...data } = user;
    return { data };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    const user = await this.svc.update(id, dto);
    const { passwordHash: _ph, ...data } = user;
    return { data };
  }

  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivate(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.svc.deactivate(id);
    const { passwordHash: _ph, ...data } = user;
    return { data };
  }
}
