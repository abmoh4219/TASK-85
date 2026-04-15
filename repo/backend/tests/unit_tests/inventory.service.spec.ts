import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { InventoryService } from '../../src/modules/inventory/inventory.service';
import { Item } from '../../src/modules/inventory/item.entity';
import { ItemCategory } from '../../src/modules/inventory/item-category.entity';
import { InventoryLevel } from '../../src/modules/inventory/inventory-level.entity';
import { StockMovement } from '../../src/modules/inventory/stock-movement.entity';
import { Alert, AlertStatus } from '../../src/modules/inventory/alert.entity';
import { ReplenishmentRecommendation, RecommendationStatus } from '../../src/modules/inventory/replenishment-recommendation.entity';
import { RecommendationFeedback } from '../../src/modules/inventory/recommendation-feedback.entity';
import { PurchaseRequest } from '../../src/modules/procurement/purchase-request.entity';
import { PurchaseRequestItem } from '../../src/modules/procurement/purchase-request-item.entity';
import { AuditLogService } from '../../src/common/services/audit-log.service';

const mockRepo = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockImplementation((d) => ({ ...d })),
  save: jest.fn().mockImplementation((d) => Promise.resolve({ id: 'id-1', ...d })),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
});

describe('InventoryService', () => {
  let service: InventoryService;
  let itemRepo: ReturnType<typeof mockRepo>;
  let categoryRepo: ReturnType<typeof mockRepo>;
  let levelRepo: ReturnType<typeof mockRepo>;
  let movementRepo: ReturnType<typeof mockRepo>;
  let alertRepo: ReturnType<typeof mockRepo>;
  let recoRepo: ReturnType<typeof mockRepo>;
  let feedbackRepo: ReturnType<typeof mockRepo>;
  let prRepo: ReturnType<typeof mockRepo>;
  let priRepo: ReturnType<typeof mockRepo>;
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    itemRepo = mockRepo();
    categoryRepo = mockRepo();
    levelRepo = mockRepo();
    movementRepo = mockRepo();
    alertRepo = mockRepo();
    recoRepo = mockRepo();
    feedbackRepo = mockRepo();
    prRepo = mockRepo();
    priRepo = mockRepo();
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: getRepositoryToken(Item), useValue: itemRepo },
        { provide: getRepositoryToken(ItemCategory), useValue: categoryRepo },
        { provide: getRepositoryToken(InventoryLevel), useValue: levelRepo },
        { provide: getRepositoryToken(StockMovement), useValue: movementRepo },
        { provide: getRepositoryToken(Alert), useValue: alertRepo },
        { provide: getRepositoryToken(ReplenishmentRecommendation), useValue: recoRepo },
        { provide: getRepositoryToken(RecommendationFeedback), useValue: feedbackRepo },
        { provide: getRepositoryToken(PurchaseRequest), useValue: prRepo },
        { provide: getRepositoryToken(PurchaseRequestItem), useValue: priRepo },
        { provide: AuditLogService, useValue: audit },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get(InventoryService);
  });

  describe('pure helpers', () => {
    it('isSafetyStockBreached true/false', () => {
      expect(service.isSafetyStockBreached(5, 10)).toBe(true);
      expect(service.isSafetyStockBreached(10, 10)).toBe(false);
      expect(service.isSafetyStockBreached(20, 10)).toBe(false);
    });

    it('checkMinMax returns below_min, above_max, null', () => {
      expect(service.checkMinMax(5, 10, 100)).toBe('below_min');
      expect(service.checkMinMax(200, 10, 100)).toBe('above_max');
      expect(service.checkMinMax(50, 10, 100)).toBeNull();
      expect(service.checkMinMax(200, 10, 0)).toBeNull();
    });

    it('isNearExpiration branches', () => {
      expect(service.isNearExpiration(null)).toBe(false);
      const now = new Date();
      const soon = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
      const far = new Date(now.getTime() + 200 * 24 * 60 * 60 * 1000);
      expect(service.isNearExpiration(soon, now)).toBe(true);
      expect(service.isNearExpiration(far, now)).toBe(false);
    });

    it('isAbnormalConsumption handles zero avg', () => {
      expect(service.isAbnormalConsumption(100, 0)).toBe(false);
      expect(service.isAbnormalConsumption(120, 10)).toBe(true);
      expect(service.isAbnormalConsumption(50, 10)).toBe(false);
    });

    it('calculateRecommendedQuantity', () => {
      expect(service.calculateRecommendedQuantity(7, 14, 2)).toBe(42);
    });
  });

  describe('getItems', () => {
    it('merges items, levels, and active alerts', async () => {
      itemRepo.find.mockResolvedValue([
        { id: 'i1', name: 'Gauze', safetyStockLevel: 10, minLevel: 5, maxLevel: 100, leadTimeDays: 3, replenishmentBufferDays: 7 },
        { id: 'i2', name: 'Swabs', safetyStockLevel: 0, minLevel: 0, maxLevel: 0, leadTimeDays: 0, replenishmentBufferDays: null },
      ]);
      levelRepo.find.mockResolvedValue([{ id: 'l1', itemId: 'i1', quantityOnHand: 50 }]);
      alertRepo.find.mockResolvedValue([{ id: 'a1', itemId: 'i1' }]);

      const res = await service.getItems();
      expect(res).toHaveLength(2);
      expect(res[0].currentStock).toBe(50);
      expect(res[1].currentStock).toBe(0);
      expect(res[0].alerts).toHaveLength(1);
    });
  });

  describe('getItem', () => {
    it('returns assembled item details', async () => {
      itemRepo.findOne.mockResolvedValue({ id: 'i1', safetyStockLevel: 10, minLevel: 0, maxLevel: 0, leadTimeDays: 5 });
      levelRepo.findOne.mockResolvedValue({ id: 'lvl1', itemId: 'i1', quantityOnHand: 20 });
      const res = await service.getItem('i1');
      expect(res.itemId).toBe('i1');
      expect(res.currentStock).toBe(20);
    });

    it('throws NotFoundException when item is missing', async () => {
      itemRepo.findOne.mockResolvedValue(null);
      await expect(service.getItem('x')).rejects.toThrow(NotFoundException);
    });

    it('falls back to zero stock when no level', async () => {
      itemRepo.findOne.mockResolvedValue({ id: 'i1', safetyStockLevel: 0, minLevel: 0, maxLevel: 0, leadTimeDays: 0 });
      levelRepo.findOne.mockResolvedValue(null);
      const res = await service.getItem('i1');
      expect(res.currentStock).toBe(0);
    });
  });

  describe('categories & items CRUD', () => {
    it('getCategories returns rows', async () => {
      categoryRepo.find.mockResolvedValue([{ id: 'c1' }]);
      expect(await service.getCategories()).toHaveLength(1);
    });

    it('createCategory saves', async () => {
      await service.createCategory({ name: 'Consumables' });
      expect(categoryRepo.save).toHaveBeenCalled();
    });

    it('updateCategory updates both fields', async () => {
      categoryRepo.findOne.mockResolvedValue({ id: 'c1', name: 'old', description: null });
      await service.updateCategory('c1', { name: 'new', description: 'desc' });
      expect(categoryRepo.save).toHaveBeenCalled();
    });

    it('updateCategory throws when missing', async () => {
      categoryRepo.findOne.mockResolvedValue(null);
      await expect(service.updateCategory('x', { name: 'n' })).rejects.toThrow(NotFoundException);
    });

    it('createItem saves', async () => {
      await service.createItem({ name: 'Gloves', sku: 'SKU-1' });
      expect(itemRepo.save).toHaveBeenCalled();
    });

    it('updateItem merges and saves', async () => {
      itemRepo.findOne.mockResolvedValue({ id: 'i1', name: 'old' });
      await service.updateItem('i1', { name: 'new' });
      expect(itemRepo.save).toHaveBeenCalled();
    });

    it('updateItem throws when missing', async () => {
      itemRepo.findOne.mockResolvedValue(null);
      await expect(service.updateItem('x', { name: 'n' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('alerts', () => {
    it('getAlerts with no status', async () => {
      await service.getAlerts();
      expect(alertRepo.find).toHaveBeenCalled();
    });

    it('getAlerts with status filter', async () => {
      await service.getAlerts(AlertStatus.ACTIVE);
      expect(alertRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: AlertStatus.ACTIVE } }),
      );
    });

    it('acknowledgeAlert happy path', async () => {
      alertRepo.findOne.mockResolvedValue({ id: 'a1', status: AlertStatus.ACTIVE });
      const res = await service.acknowledgeAlert('a1', 'u1');
      expect(res.status).toBe(AlertStatus.ACKNOWLEDGED);
      expect(audit.log).toHaveBeenCalled();
    });

    it('acknowledgeAlert throws NotFoundException', async () => {
      alertRepo.findOne.mockResolvedValue(null);
      await expect(service.acknowledgeAlert('x', 'u1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('runAllAlertChecks', () => {
    it('exercises all alert branches (critical expiry + safety stock breach)', async () => {
      const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      itemRepo.find.mockResolvedValue([
        {
          id: 'i1', safetyStockLevel: 10, minLevel: 5, maxLevel: 100,
          leadTimeDays: 3, replenishmentBufferDays: 7, expiresAt: future,
        },
      ]);
      levelRepo.find.mockResolvedValue([{ itemId: 'i1', quantityOnHand: 2 }]);
      movementRepo.find
        .mockResolvedValueOnce([{ quantity: 100 }])
        .mockResolvedValueOnce([{ quantity: 500 }]);
      alertRepo.findOne.mockResolvedValue(null);
      await service.runAllAlertChecks();
      expect(alertRepo.save).toHaveBeenCalled();
    });

    it('resolves alerts when levels healthy and no expiry', async () => {
      itemRepo.find.mockResolvedValue([
        { id: 'i1', safetyStockLevel: 5, minLevel: 0, maxLevel: 0, leadTimeDays: 0, replenishmentBufferDays: 7, expiresAt: null },
      ]);
      levelRepo.find.mockResolvedValue([{ itemId: 'i1', quantityOnHand: 50 }]);
      movementRepo.find.mockResolvedValue([]);
      await service.runAllAlertChecks();
      expect(alertRepo.update).toHaveBeenCalled();
    });

    it('upsertAlert updates existing alert', async () => {
      itemRepo.find.mockResolvedValue([
        { id: 'i1', safetyStockLevel: 10, minLevel: 0, maxLevel: 0, leadTimeDays: 0, replenishmentBufferDays: 7, expiresAt: null },
      ]);
      levelRepo.find.mockResolvedValue([{ itemId: 'i1', quantityOnHand: 2 }]);
      movementRepo.find.mockResolvedValue([]);
      alertRepo.findOne.mockResolvedValue({ id: 'existing-alert' });
      await service.runAllAlertChecks();
      expect(alertRepo.update).toHaveBeenCalled();
    });

    it('exercises high severity (8-14 days expiry)', async () => {
      const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      itemRepo.find.mockResolvedValue([
        { id: 'i1', safetyStockLevel: 0, minLevel: 0, maxLevel: 0, leadTimeDays: 0, replenishmentBufferDays: 7, expiresAt: future },
      ]);
      levelRepo.find.mockResolvedValue([{ itemId: 'i1', quantityOnHand: 5 }]);
      movementRepo.find.mockResolvedValue([]);
      alertRepo.findOne.mockResolvedValue(null);
      await service.runAllAlertChecks();
      expect(alertRepo.save).toHaveBeenCalled();
    });

    it('exercises medium severity expiry and above_max branch', async () => {
      const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      itemRepo.find.mockResolvedValue([
        { id: 'i1', safetyStockLevel: 0, minLevel: 0, maxLevel: 10, leadTimeDays: 0, replenishmentBufferDays: 7, expiresAt: future },
      ]);
      levelRepo.find.mockResolvedValue([{ itemId: 'i1', quantityOnHand: 100 }]);
      movementRepo.find.mockResolvedValue([]);
      alertRepo.findOne.mockResolvedValue(null);
      await service.runAllAlertChecks();
      expect(alertRepo.save).toHaveBeenCalled();
    });
  });

  describe('recommendations', () => {
    it('generateRecommendations creates recos for items with usage', async () => {
      itemRepo.find.mockResolvedValue([
        { id: 'i1', leadTimeDays: 3, replenishmentBufferDays: 7 },
        { id: 'i2', leadTimeDays: 0, replenishmentBufferDays: 0 },
      ]);
      movementRepo.find
        .mockResolvedValueOnce([{ quantity: 500 }])
        .mockResolvedValueOnce([]);
      const res = await service.generateRecommendations({});
      expect(res.length).toBeGreaterThanOrEqual(1);
    });

    it('generateRecommendations filters by itemId', async () => {
      itemRepo.find.mockResolvedValue([]);
      await service.generateRecommendations({ itemId: 'i1' });
      expect(itemRepo.find).toHaveBeenCalledWith({ where: { id: 'i1' } });
    });

    it('generateRecommendations skips zero-usage items', async () => {
      itemRepo.find.mockResolvedValue([{ id: 'i1', leadTimeDays: 3, replenishmentBufferDays: 7 }]);
      movementRepo.find.mockResolvedValue([]);
      const res = await service.generateRecommendations({});
      expect(res).toHaveLength(0);
    });

    it('getRecommendations returns pending', async () => {
      recoRepo.find.mockResolvedValue([{ id: 'r1' }]);
      const res = await service.getRecommendations();
      expect(res).toHaveLength(1);
    });

    it('acceptRecommendation drafts PR', async () => {
      recoRepo.findOne.mockResolvedValue({
        id: 'r1', itemId: 'i1', recommendedQuantity: 30,
        item: { name: 'Gauze', unitOfMeasure: 'box' },
      });
      const res = await service.acceptRecommendation('r1', 'u1');
      expect(res.purchaseRequest).toBeDefined();
      expect(audit.log).toHaveBeenCalled();
    });

    it('acceptRecommendation handles missing item relation', async () => {
      recoRepo.findOne.mockResolvedValue({ id: 'r1', itemId: 'i1', recommendedQuantity: 5, item: null });
      const res = await service.acceptRecommendation('r1', 'u1');
      expect(res).toBeDefined();
    });

    it('acceptRecommendation throws when missing', async () => {
      recoRepo.findOne.mockResolvedValue(null);
      await expect(service.acceptRecommendation('x', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('dismissRecommendation sets dismissed', async () => {
      recoRepo.findOne.mockResolvedValue({ id: 'r1', status: RecommendationStatus.PENDING });
      const res = await service.dismissRecommendation('r1', 'u1');
      expect(res.status).toBe(RecommendationStatus.DISMISSED);
    });

    it('dismissRecommendation throws when missing', async () => {
      recoRepo.findOne.mockResolvedValue(null);
      await expect(service.dismissRecommendation('x', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('recordImpression records new one', async () => {
      recoRepo.findOne.mockResolvedValue({ id: 'r1' });
      feedbackRepo.findOne.mockResolvedValue(null);
      const res = await service.recordImpression('r1', 'u1');
      expect(res.recorded).toBe(true);
    });

    it('recordImpression deduplicates', async () => {
      recoRepo.findOne.mockResolvedValue({ id: 'r1' });
      feedbackRepo.findOne.mockResolvedValue({ id: 'f1' });
      const res = await service.recordImpression('r1', 'u1');
      expect(res).toEqual({ recorded: false, deduplicated: true });
    });

    it('recordImpression throws when reco missing', async () => {
      recoRepo.findOne.mockResolvedValue(null);
      await expect(service.recordImpression('x', 'u1')).rejects.toThrow(NotFoundException);
    });
  });
});
