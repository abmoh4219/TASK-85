import {
  Controller, Get, Patch, Param, Body, Query, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../users/user.entity';
import { AnomalyEventStatus } from './anomaly-event.entity';
import { ReviewAnomalyDto } from './dto/review-anomaly.dto';

type AuthUser = { id: string; role: UserRole };

@Controller()
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get('notifications')
  async getMyNotifications(@CurrentUser() user: AuthUser) {
    const data = await this.svc.getForUser(user.id);
    return { data };
  }

  @Get('notifications/unread-count')
  async getUnreadCount(@CurrentUser() user: AuthUser) {
    const count = await this.svc.getUnreadCount(user.id);
    return { data: { count } };
  }

  @Patch('notifications/:id/read')
  @HttpCode(HttpStatus.OK)
  async markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.svc.markRead(id, user.id);
    return { data };
  }

  @Patch('notifications/read-all')
  @HttpCode(HttpStatus.OK)
  async markAllRead(@CurrentUser() user: AuthUser) {
    await this.svc.markAllRead(user.id);
    return { data: { success: true } };
  }

  @Get('anomalies')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  async getAnomalies(@Query('status') status?: AnomalyEventStatus) {
    const data = await this.svc.getAnomalies(status);
    return { data };
  }

  @Patch('anomalies/:id/review')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @HttpCode(HttpStatus.OK)
  async reviewAnomaly(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewAnomalyDto,
    @CurrentUser() user: AuthUser,
  ) {
    const data = await this.svc.reviewAnomaly(id, user.id, dto.notes, dto.status);
    return { data };
  }
}
