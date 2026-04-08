import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseGuards, HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { AlertsService } from './alerts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequireAction } from '../../common/decorators/require-action.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../users/user.entity';
import { AlertStatus } from './alert.entity';
import { GenerateRecommendationsDto } from './dto/generate-recommendations.dto';
import { CreateCategoryDto, UpdateCategoryDto, CreateItemDto, UpdateItemDto } from './dto/catalog.dto';

type AuthUser = { id: string; role: UserRole };

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(
    private readonly service: InventoryService,
    private readonly alertsService: AlertsService,
  ) {}

  // ── Items ─────────────────────────────────────────────────────────────────

  @Get('items')
  async getItems() {
    const data = await this.service.getItems();
    return { data };
  }

  @Get('items/:id')
  async getItem(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.service.getItem(id);
    return { data };
  }

  // ── Catalog Management (Admin) ────────────────────────────────────────────

  @Get('categories')
  async getCategories() {
    const data = await this.service.getCategories();
    return { data };
  }

  @Post('categories')
  @Roles(UserRole.ADMIN)
  async createCategory(@Body() dto: CreateCategoryDto) {
    const data = await this.service.createCategory(dto);
    return { data };
  }

  @Patch('categories/:id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    const data = await this.service.updateCategory(id, dto);
    return { data };
  }

  @Post('items')
  @Roles(UserRole.ADMIN)
  async createItem(@Body() dto: CreateItemDto) {
    const data = await this.service.createItem(dto);
    return { data };
  }

  @Patch('items/:id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateItemDto,
  ) {
    const data = await this.service.updateItem(id, dto);
    return { data };
  }

  // ── Alerts ─────────────────────────────────────────────────────────────────

  @Get('alerts')
  async getAlerts(@Query('status') status?: AlertStatus) {
    const data = await this.service.getAlerts(status);
    return { data };
  }

  @Patch('alerts/:id/acknowledge')
  @RequireAction('inventory:acknowledge-alert')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @HttpCode(HttpStatus.OK)
  async acknowledgeAlert(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.acknowledgeAlert(id, user.id);
    return { data };
  }

  @Post('alerts/run-checks')
  @RequireAction('inventory:run-checks')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async runAlertChecks() {
    await this.alertsService.runAlertChecks();
    return { data: { triggered: true } };
  }

  // ── Replenishment Recommendations ─────────────────────────────────────────

  @Get('recommendations')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async getRecommendations() {
    const data = await this.service.getRecommendations();
    return { data };
  }

  @Post('recommendations/generate')
  @RequireAction('inventory:generate-recs')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async generateRecommendations(@Body() dto: GenerateRecommendationsDto) {
    const data = await this.service.generateRecommendations(dto);
    return { data };
  }

  @Post('recommendations/:id/accept')
  @RequireAction('inventory:accept-rec')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async acceptRecommendation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.acceptRecommendation(id, user.id);
    return { data };
  }

  @Post('recommendations/:id/dismiss')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async dismissRecommendation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.dismissRecommendation(id, user.id);
    return { data };
  }

  @Post('recommendations/:id/impression')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @HttpCode(HttpStatus.OK)
  async recordImpression(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.service.recordImpression(id, user.id);
    return { data };
  }
}
