import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';
import { AnomalyEvent, AnomalyEventStatus } from './anomaly-event.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
    @InjectRepository(AnomalyEvent)
    private readonly anomalyRepo: Repository<AnomalyEvent>,
  ) {}

  async getForUser(userId: string): Promise<Notification[]> {
    return this.notifRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notifRepo.count({ where: { userId, isRead: false } });
  }

  async markRead(id: string, userId: string): Promise<Notification> {
    const notif = await this.notifRepo.findOne({ where: { id, userId } });
    if (!notif) throw new NotFoundException('Notification not found');
    await this.notifRepo.update(id, { isRead: true, readAt: new Date() });
    return this.notifRepo.findOne({ where: { id } }) as Promise<Notification>;
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notifRepo.update({ userId, isRead: false }, { isRead: true, readAt: new Date() });
  }

  async getAnomalies(status?: AnomalyEventStatus): Promise<AnomalyEvent[]> {
    const where = status ? { status } : {};
    return this.anomalyRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async reviewAnomaly(
    id: string,
    reviewedById: string,
    notes?: string,
    status: AnomalyEventStatus = AnomalyEventStatus.REVIEWED,
  ): Promise<AnomalyEvent> {
    const anomaly = await this.anomalyRepo.findOne({ where: { id } });
    if (!anomaly) throw new NotFoundException('Anomaly event not found');
    await this.anomalyRepo.update(id, {
      status,
      reviewedById,
      reviewedAt: new Date(),
      reviewNotes: notes ?? null,
    });
    return this.anomalyRepo.findOne({ where: { id } }) as Promise<AnomalyEvent>;
  }
}
