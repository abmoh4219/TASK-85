import {
  Controller, Get, Post, Patch, Body, Param,
  UseGuards, Req, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { LabService } from './lab.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../users/user.entity';
import { SampleStatus } from './lab-sample.entity';
import { CreateSampleDto } from './dto/create-sample.dto';
import { SubmitResultsDto } from './dto/submit-results.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { EditReportDto } from './dto/edit-report.dto';
import { CreateTestDto } from './dto/create-test.dto';

type AuthUser = { id: string; role: UserRole };

@Controller('lab')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LabController {
  constructor(private readonly service: LabService) {}

  // ── Test Dictionary ────────────────────────────────────────────────────

  @Post('tests')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async createTest(@Body() dto: CreateTestDto, @CurrentUser() user: AuthUser) {
    const data = await this.service.createTest(dto, user.id);
    return { data };
  }

  @Get('tests')
  async getTests() {
    const data = await this.service.getTests();
    return { data };
  }

  @Patch('tests/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @HttpCode(HttpStatus.OK)
  async updateTest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateTestDto>,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.updateTest(id, dto, user.id);
    return { data };
  }

  // ── Samples ─────────────────────────────────────────────────────────────

  @Post('samples')
  async createSample(@Body() dto: CreateSampleDto, @CurrentUser() user: AuthUser) {
    const data = await this.service.createSample(dto, user.id);
    return { data };
  }

  @Get('samples')
  async getSamples(@CurrentUser() user: AuthUser) {
    const data = await this.service.getSamples(user);
    return { data };
  }

  @Get('samples/:id')
  async getSample(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.service.getSample(id);
    return { data };
  }

  @Patch('samples/:id/status')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @HttpCode(HttpStatus.OK)
  async advanceSampleStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: SampleStatus,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.advanceSampleStatus(id, status, user.id);
    return { data };
  }

  // ── Results ─────────────────────────────────────────────────────────────

  @Post('samples/:id/results')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async submitResults(
    @Param('id', ParseUUIDPipe) sampleId: string,
    @Body() dto: SubmitResultsDto,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.submitResults(sampleId, dto, user.id);
    return { data };
  }

  // ── Reports ──────────────────────────────────────────────────────────────

  @Post('samples/:id/report')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async createReport(
    @Param('id', ParseUUIDPipe) sampleId: string,
    @Body() dto: CreateReportDto,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.createReport(sampleId, dto, user.id);
    return { data };
  }

  @Get('reports/:id')
  async getReport(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.service.getReport(id);
    return { data };
  }

  @Patch('reports/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @HttpCode(HttpStatus.OK)
  async editReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EditReportDto,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.editReport(id, dto, user.id);
    return { data };
  }

  @Get('reports/:id/history')
  async getReportHistory(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.service.getReportHistory(id);
    return { data };
  }

  @Patch('reports/:id/archive')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @HttpCode(HttpStatus.OK)
  async archiveReport(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.archiveReport(id, user.id);
    return { data };
  }
}
