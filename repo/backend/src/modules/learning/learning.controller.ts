import {
  Controller, Get, Post, Patch, Body, Param,
  UseGuards, HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import { LearningService } from './learning.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../users/user.entity';
import { LearningPlanStatus } from './learning-plan.entity';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreateGoalDto } from './dto/create-goal.dto';
import { LogSessionDto } from './dto/log-session.dto';

type AuthUser = { id: string; role: UserRole };

@Controller('learning')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LearningController {
  constructor(private readonly service: LearningService) {}

  @Post('plans')
  @Roles(UserRole.ADMIN, UserRole.HR)
  async createPlan(@Body() dto: CreatePlanDto, @CurrentUser() user: AuthUser) {
    const data = await this.service.createPlan(dto, user.id);
    return { data };
  }

  @Get('plans')
  async getPlans(@CurrentUser() user: AuthUser) {
    const data = await this.service.getPlans(user);
    return { data };
  }

  @Get('plans/:id')
  async getPlan(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.service.getPlan(id);
    return { data };
  }

  @Patch('plans/:id/status')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @HttpCode(HttpStatus.OK)
  async advancePlanStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: LearningPlanStatus,
    @Body('reason') reason: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.advancePlanStatus(id, status, user.id, reason);
    return { data };
  }

  @Get('plans/:id/lifecycle')
  async getPlanLifecycle(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.service.getPlanLifecycle(id);
    return { data };
  }

  @Post('plans/:id/goals')
  @Roles(UserRole.ADMIN, UserRole.HR)
  async createGoal(
    @Param('id', ParseUUIDPipe) planId: string,
    @Body() dto: CreateGoalDto,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.createGoal(planId, dto, user.id);
    return { data };
  }

  @Get('plans/:id/goals')
  async getGoals(@Param('id', ParseUUIDPipe) planId: string) {
    const data = await this.service.getGoals(planId);
    return { data };
  }

  @Post('goals/:id/sessions')
  async logStudySession(
    @Param('id', ParseUUIDPipe) goalId: string,
    @Body() dto: LogSessionDto,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.logStudySession(goalId, dto, user.id);
    return { data };
  }

  @Get('goals/:id/compliance')
  async checkFrequencyCompliance(@Param('id', ParseUUIDPipe) goalId: string) {
    const data = await this.service.checkFrequencyCompliance(goalId);
    return { data };
  }
}
