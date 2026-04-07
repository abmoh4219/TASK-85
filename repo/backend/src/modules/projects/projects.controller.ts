import {
  Controller, Get, Post, Patch, Body, Param,
  UseGuards, HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequireAction } from '../../common/decorators/require-action.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../users/user.entity';
import { ProjectStatus } from './project.entity';
import { TaskStatus } from './project-task.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { CreateMilestoneDto, UpdateMilestoneDto } from './dto/create-milestone.dto';
import { SubmitDeliverableDto } from './dto/submit-deliverable.dto';
import { AcceptanceScoreDto } from './dto/acceptance-score.dto';

type AuthUser = { id: string; role: UserRole };

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  // ── Projects ───────────────────────────────────────────────────────��──────

  @Post()
  @RequireAction('projects:create')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async createProject(@Body() dto: CreateProjectDto, @CurrentUser() user: AuthUser) {
    const data = await this.service.createProject(dto, user.id);
    return { data };
  }

  @Get()
  async getProjects(@CurrentUser() user: AuthUser) {
    const data = await this.service.getProjects(user);
    return { data };
  }

  @Get(':id')
  async getProject(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    const data = await this.service.getProject(id, user);
    return { data };
  }

  @Patch(':id/status')
  @RequireAction('projects:advance-status')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @HttpCode(HttpStatus.OK)
  async advanceStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: ProjectStatus,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.advanceProjectStatus(id, status, user.id);
    return { data };
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────

  @Post(':id/tasks')
  @RequireAction('projects:create-task')
  async createTask(
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.createTask(projectId, dto, user.id);
    return { data };
  }

  @Get(':id/tasks')
  async getTasks(@Param('id', ParseUUIDPipe) projectId: string) {
    const data = await this.service.getTasks(projectId);
    return { data };
  }

  @Patch(':id/tasks/:taskId/status')
  @RequireAction('projects:advance-task')
  @HttpCode(HttpStatus.OK)
  async advanceTaskStatus(
    @Param('id', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body('status') status: TaskStatus,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.advanceTaskStatus(projectId, taskId, status, user.id, user.role);
    return { data };
  }

  // ── Milestones ──────────────────────���─────────────────────────────────────

  @Post(':id/milestones')
  @RequireAction('projects:create-milestone')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async createMilestone(
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateMilestoneDto,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.createMilestone(projectId, dto, user.id);
    return { data };
  }

  @Get(':id/milestones')
  async getMilestones(@Param('id', ParseUUIDPipe) projectId: string) {
    const data = await this.service.getMilestones(projectId);
    return { data };
  }

  @Patch(':id/milestones/:milestoneId')
  @RequireAction('projects:update-milestone')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @HttpCode(HttpStatus.OK)
  async updateMilestone(
    @Param('id', ParseUUIDPipe) projectId: string,
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Body() dto: UpdateMilestoneDto,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.updateMilestone(projectId, milestoneId, dto, user.id);
    return { data };
  }

  // ── Deliverables ──────────────────────────────────────────────────���───────

  @Post(':id/tasks/:taskId/deliverables')
  @RequireAction('projects:submit-deliverable')
  async submitDeliverable(
    @Param('id', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: SubmitDeliverableDto,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.submitDeliverable(projectId, taskId, dto, user.id);
    return { data };
  }

  // ── Acceptance Scoring ─���─────────────────────────��────────────────────────

  @Post(':id/acceptance-score')
  @RequireAction('projects:score-acceptance')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async scoreAcceptance(
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body() dto: AcceptanceScoreDto,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.scoreAcceptance(projectId, dto, user.id);
    return { data };
  }

  @Get(':id/acceptance-score')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async getAcceptanceScores(@Param('id', ParseUUIDPipe) projectId: string) {
    const data = await this.service.getAcceptanceScores(projectId);
    return { data };
  }
}
