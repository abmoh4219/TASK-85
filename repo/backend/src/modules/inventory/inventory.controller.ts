import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseGuards, HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { AlertsService } from './alerts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../users/user.entity';
import { AlertStatus } from './alert.entity';
import { GenerateRecommendationsDto } from './dto/generate-recommendations.dto';

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

  // ── Alerts ─────────────────────────────────────────────────────────────────

  @Get('alerts')
  async getAlerts(@Query('status') status?: AlertStatus) {
    const data = await this.service.getAlerts(status);
    return { data };
  }

  @Patch('alerts/:id/acknowledge')
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
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async generateRecommendations(@Body() dto: GenerateRecommendationsDto) {
    const data = await this.service.generateRecommendations(dto);
    return { data };
  }

  @Post('recommendations/:id/accept')
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
