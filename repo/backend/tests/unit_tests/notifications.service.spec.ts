import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from '../../src/modules/notifications/notifications.service';
import { Notification } from '../../src/modules/notifications/notification.entity';
import { AnomalyEvent, AnomalyEventStatus } from '../../src/modules/notifications/anomaly-event.entity';

const makeRepo = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  count: jest.fn().mockResolvedValue(0),
  update: jest.fn().mockResolvedValue({}),
});

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notifRepo: ReturnType<typeof makeRepo>;
  let anomalyRepo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    notifRepo = makeRepo();
    anomalyRepo = makeRepo();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(Notification), useValue: notifRepo },
        { provide: getRepositoryToken(AnomalyEvent), useValue: anomalyRepo },
      ],
    }).compile();
    service = module.get(NotificationsService);
  });

  describe('getForUser', () => {
    it('returns latest notifications for user', async () => {
      notifRepo.find.mockResolvedValue([{ id: 'n1' }]);
      const res = await service.getForUser('u1');
      expect(res).toHaveLength(1);
    });
  });

  describe('getUnreadCount', () => {
    it('returns unread count', async () => {
      notifRepo.count.mockResolvedValue(5);
      const res = await service.getUnreadCount('u1');
      expect(res).toBe(5);
    });
  });

  describe('markRead', () => {
    it('marks notification as read', async () => {
      notifRepo.findOne
        .mockResolvedValueOnce({ id: 'n1', userId: 'u1', isRead: false })
        .mockResolvedValueOnce({ id: 'n1', userId: 'u1', isRead: true });
      const res = await service.markRead('n1', 'u1');
      expect(res).toBeDefined();
      expect(notifRepo.update).toHaveBeenCalled();
    });

    it('throws NotFoundException when notification not found', async () => {
      notifRepo.findOne.mockResolvedValue(null);
      await expect(service.markRead('n1', 'u1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllRead', () => {
    it('updates all unread for user', async () => {
      await service.markAllRead('u1');
      expect(notifRepo.update).toHaveBeenCalled();
    });
  });

  describe('getAnomalies', () => {
    it('returns all anomalies when status omitted', async () => {
      anomalyRepo.find.mockResolvedValue([{ id: 'a1' }]);
      const res = await service.getAnomalies();
      expect(res).toHaveLength(1);
    });

    it('filters by status when provided', async () => {
      await service.getAnomalies(AnomalyEventStatus.PENDING);
      expect(anomalyRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: AnomalyEventStatus.PENDING } }),
      );
    });
  });

  describe('reviewAnomaly', () => {
    it('reviews anomaly with default status', async () => {
      anomalyRepo.findOne
        .mockResolvedValueOnce({ id: 'a1' })
        .mockResolvedValueOnce({ id: 'a1', status: AnomalyEventStatus.REVIEWED });
      const res = await service.reviewAnomaly('a1', 'rev1', 'note');
      expect(anomalyRepo.update).toHaveBeenCalled();
      expect(res).toBeDefined();
    });

    it('uses null notes when omitted', async () => {
      anomalyRepo.findOne
        .mockResolvedValueOnce({ id: 'a1' })
        .mockResolvedValueOnce({ id: 'a1' });
      await service.reviewAnomaly('a1', 'rev1');
      expect(anomalyRepo.update).toHaveBeenCalledWith(
        'a1',
        expect.objectContaining({ reviewNotes: null }),
      );
    });

    it('throws NotFoundException when anomaly missing', async () => {
      anomalyRepo.findOne.mockResolvedValue(null);
      await expect(service.reviewAnomaly('x', 'rev1')).rejects.toThrow(NotFoundException);
    });
  });
});
