import {
  Controller, Get, Patch, Param, Body, Query, Request,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/user.entity';
import { AnomalyEventStatus } from './anomaly-event.entity';

@Controller()
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get('notifications')
  async getMyNotifications(@Request() req: { user: { id: string } }) {
    const data = await this.svc.getForUser(req.user.id);
    return { data };
  }

  @Get('notifications/unread-count')
  async getUnreadCount(@Request() req: { user: { id: string } }) {
    const count = await this.svc.getUnreadCount(req.user.id);
    return { data: { count } };
  }

  @Patch('notifications/:id/read')
  async markRead(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    const data = await this.svc.markRead(id, req.user.id);
    return { data };
  }

  @Patch('notifications/read-all')
  async markAllRead(@Request() req: { user: { id: string } }) {
    await this.svc.markAllRead(req.user.id);
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
  async reviewAnomaly(
    @Param('id') id: string,
    @Body() body: { notes?: string; status?: AnomalyEventStatus },
    @Request() req: { user: { id: string } },
  ) {
    const data = await this.svc.reviewAnomaly(id, req.user.id, body.notes, body.status);
    return { data };
  }
}
