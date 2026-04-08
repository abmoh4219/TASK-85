import {
  Controller, Get, Patch, Param, Body,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequireAction } from '../../common/decorators/require-action.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../users/user.entity';
import { UpdatePolicyDto } from './dto/update-policy.dto';

type AuthUser = { id: string; role: UserRole };

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get()
  async getAllPolicies() {
    const data = await this.service.getAllPolicies();
    return { data };
  }

  @Get(':key')
  async getPolicy(@Param('key') key: string) {
    const data = await this.service.getPolicy(key);
    return { data };
  }

  @Patch(':key')
  @RequireAction('admin:manage-settings')
  @HttpCode(HttpStatus.OK)
  async updatePolicy(
    @Param('key') key: string,
    @Body() dto: UpdatePolicyDto,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.updatePolicy(key, dto.value, user.id);
    return { data };
  }
}
