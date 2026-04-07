import {
  Controller, Get, Post, Patch, Body, Param,
  UseGuards, HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import { RulesEngineService } from './rules-engine.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequireAction } from '../../common/decorators/require-action.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../users/user.entity';
import { CreateRuleDto, UpdateRuleDto } from './dto/create-rule.dto';

type AuthUser = { id: string; role: UserRole };

@Controller('rules')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class RulesEngineController {
  constructor(private readonly service: RulesEngineService) {}

  @Post()
  @RequireAction('rules:create')
  async createRule(@Body() dto: CreateRuleDto, @CurrentUser() user: AuthUser) {
    const data = await this.service.createRule(dto, user.id);
    return { data };
  }

  @Get()
  async getRules() {
    const data = await this.service.getRules();
    return { data };
  }

  @Get(':id')
  async getRule(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.service.getRule(id);
    return { data };
  }

  @Patch(':id')
  @RequireAction('rules:update')
  @HttpCode(HttpStatus.OK)
  async updateRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRuleDto,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.updateRule(id, dto, user.id);
    return { data };
  }

  @Post('validate')
  async validateConflicts(@Body() dto: CreateRuleDto) {
    const data = await this.service.validateConflicts(dto);
    return { data };
  }

  @Get(':id/impact')
  async assessImpact(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.service.assessImpact(id);
    return { data };
  }

  @Patch(':id/rollout')
  @RequireAction('rules:stage-rollout')
  @HttpCode(HttpStatus.OK)
  async stageRollout(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('rolloutPercentage') rolloutPercentage: number,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.stageRollout(id, rolloutPercentage, user.id);
    return { data };
  }

  @Patch(':id/activate')
  @RequireAction('rules:activate')
  @HttpCode(HttpStatus.OK)
  async activateRule(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.activateRule(id, user.id);
    return { data };
  }

  @Get(':id/evaluate')
  async evaluateRule(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.evaluateRuleForUser(id, user.id);
    return { data };
  }

  @Post(':id/rollback')
  @RequireAction('rules:rollback')
  async rollbackRule(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.rollbackRule(id, user.id);
    return { data };
  }
}
