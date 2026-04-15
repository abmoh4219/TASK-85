import { Test, TestingModule } from '@nestjs/testing';
import { AlertsService } from '../../src/modules/inventory/alerts.service';
import { InventoryService } from '../../src/modules/inventory/inventory.service';

describe('AlertsService', () => {
  let service: AlertsService;
  let inventory: { runAllAlertChecks: jest.Mock };

  beforeEach(async () => {
    inventory = { runAllAlertChecks: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        { provide: InventoryService, useValue: inventory },
      ],
    }).compile();
    service = module.get(AlertsService);
  });

  describe('runAlertChecks', () => {
    it('calls inventoryService.runAllAlertChecks on happy path', async () => {
      await service.runAlertChecks();
      expect(inventory.runAllAlertChecks).toHaveBeenCalled();
    });

    it('swallows errors raised by inventory service', async () => {
      inventory.runAllAlertChecks.mockRejectedValue(new Error('boom'));
      await expect(service.runAlertChecks()).resolves.toBeUndefined();
    });
  });
});
