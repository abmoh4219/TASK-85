import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ProcurementService } from '../procurement.service';
import { PurchaseRequest, PurchaseRequestStatus } from '../purchase-request.entity';
import { PurchaseRequestItem } from '../purchase-request-item.entity';
import { RFQ } from '../rfq.entity';
import { RFQLine } from '../rfq-line.entity';
import { VendorQuote } from '../vendor-quote.entity';
import { Vendor } from '../vendor.entity';
import { PurchaseOrder, POStatus } from '../purchase-order.entity';
import { POLine } from '../po-line.entity';
import { POReceipt } from '../po-receipt.entity';
import { POReceiptLine } from '../po-receipt-line.entity';
import { PutAway } from '../put-away.entity';
import { Reconciliation } from '../reconciliation.entity';
import { InventoryLevel } from '../../inventory/inventory-level.entity';
import { StockMovement } from '../../inventory/stock-movement.entity';
import { AuditLogService } from '../../../common/services/audit-log.service';

const mockRepo = () => ({
  create: jest.fn().mockImplementation((d) => d),
  save: jest.fn().mockImplementation((d) => Promise.resolve({ id: 'test-id', ...d })),
  findOne: jest.fn().mockResolvedValue(null),
  find: jest.fn().mockResolvedValue([]),
  update: jest.fn().mockResolvedValue({}),
});

const mockAuditLog = () => ({ log: jest.fn().mockResolvedValue(undefined) });

describe('ProcurementService — price lock', () => {
  let service: ProcurementService;
  let poRepo: ReturnType<typeof mockRepo>;
  let poLineRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    poRepo = mockRepo();
    poLineRepo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcurementService,
        { provide: getRepositoryToken(PurchaseRequest), useValue: mockRepo() },
        { provide: getRepositoryToken(PurchaseRequestItem), useValue: mockRepo() },
        { provide: getRepositoryToken(RFQ), useValue: mockRepo() },
        { provide: getRepositoryToken(RFQLine), useValue: mockRepo() },
        { provide: getRepositoryToken(VendorQuote), useValue: mockRepo() },
        { provide: getRepositoryToken(Vendor), useValue: mockRepo() },
        { provide: getRepositoryToken(PurchaseOrder), useValue: poRepo },
        { provide: getRepositoryToken(POLine), useValue: poLineRepo },
        { provide: getRepositoryToken(POReceipt), useValue: mockRepo() },
        { provide: getRepositoryToken(POReceiptLine), useValue: mockRepo() },
        { provide: getRepositoryToken(PutAway), useValue: mockRepo() },
        { provide: getRepositoryToken(Reconciliation), useValue: mockRepo() },
        { provide: getRepositoryToken(InventoryLevel), useValue: mockRepo() },
        { provide: getRepositoryToken(StockMovement), useValue: mockRepo() },
        { provide: AuditLogService, useValue: mockAuditLog() },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get<ProcurementService>(ProcurementService);
  });

  describe('price lock enforcement', () => {
    it('throws BadRequestException when modifying price within 30-day lock', async () => {
      const lockDate = new Date(Date.now() + 29 * 24 * 60 * 60 * 1000); // 29 days from now
      poRepo.findOne.mockResolvedValue({
        id: 'po-id',
        status: POStatus.APPROVED,
        priceLockedUntil: lockDate,
      });
      poLineRepo.findOne.mockResolvedValue({ id: 'line-id', purchaseOrderId: 'po-id', unitPrice: 10 });

      await expect(
        service.updatePOLinePrice('po-id', 'line-id', 15, 'user-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows price update after 30-day lock expires', async () => {
      const lockDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
      poRepo.findOne.mockResolvedValue({
        id: 'po-id',
        status: POStatus.APPROVED,
        priceLockedUntil: lockDate,
      });
      poLineRepo.findOne.mockResolvedValue({ id: 'line-id', purchaseOrderId: 'po-id', unitPrice: 10 });

      const result = await service.updatePOLinePrice('po-id', 'line-id', 15, 'user-id');
      expect(poLineRepo.save).toHaveBeenCalled();
    });

    it('allows price update when no lock is set', async () => {
      poRepo.findOne.mockResolvedValue({
        id: 'po-id',
        status: POStatus.DRAFT,
        priceLockedUntil: null,
      });
      poLineRepo.findOne.mockResolvedValue({ id: 'line-id', purchaseOrderId: 'po-id', unitPrice: 10 });

      await service.updatePOLinePrice('po-id', 'line-id', 15, 'user-id');
      expect(poLineRepo.save).toHaveBeenCalled();
    });
  });

  describe('partial delivery logic via receiveOrder', () => {
    it('transitions PO to PARTIALLY_RECEIVED after partial receipt', async () => {
      const receiptRepo = (service as any).receiptRepo;
      const receiptLineRepo = (service as any).receiptLineRepo;

      // PO exists in APPROVED state
      poRepo.findOne.mockResolvedValue({
        id: 'po-id',
        status: POStatus.APPROVED,
        priceLockedUntil: null,
      });

      // Receipt create/save
      receiptRepo.create = jest.fn().mockReturnValue({ id: 'receipt-id', purchaseOrderId: 'po-id' });
      receiptRepo.save = jest.fn().mockResolvedValue({ id: 'receipt-id' });
      receiptRepo.findOne = jest.fn().mockResolvedValue({ id: 'receipt-id', lines: [{ id: 'rl-1' }] });
      receiptLineRepo.create = jest.fn().mockReturnValue({ id: 'rl-1' });
      receiptLineRepo.save = jest.fn().mockResolvedValue([{ id: 'rl-1' }]);

      // PO lines: line-1 needs 100, has 0 received; line-2 needs 50, has 0 received
      const lines = [
        { id: 'line-1', purchaseOrderId: 'po-id', quantity: 100, receivedQuantity: 0, backorderQuantity: 100 },
        { id: 'line-2', purchaseOrderId: 'po-id', quantity: 50, receivedQuantity: 0, backorderQuantity: 50 },
      ];
      // After update: line-1 gets 60 (partial), line-2 still 0
      const updatedLines = [
        { id: 'line-1', purchaseOrderId: 'po-id', quantity: 100, receivedQuantity: 60, backorderQuantity: 40 },
        { id: 'line-2', purchaseOrderId: 'po-id', quantity: 50, receivedQuantity: 0, backorderQuantity: 50 },
      ];
      poLineRepo.find.mockResolvedValueOnce(lines).mockResolvedValueOnce(updatedLines);

      await service.receiveOrder('po-id', {
        notes: 'partial',
        lines: [{ poLineId: 'line-1', receivedQuantity: 60 }],
      }, 'user-id');

      // Assert PO status was updated
      expect(poRepo.update).toHaveBeenCalledWith('po-id', { status: POStatus.PARTIALLY_RECEIVED });
      // Assert PO line received quantity was updated
      expect(poLineRepo.update).toHaveBeenCalledWith('line-1', expect.objectContaining({
        receivedQuantity: 60,
      }));
    });
  });

  describe('substitute approval', () => {
    it('throws NotFoundException when request item not found', async () => {
      const prRepo = (service as any).prRepo;
      prRepo.findOne = jest.fn().mockResolvedValue({
        id: 'pr-id',
        status: PurchaseRequestStatus.APPROVED,
        items: [],
      });
      const priRepo = (service as any).priRepo;
      priRepo.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        service.approveSubstitute(
          'pr-id',
          { purchaseRequestItemId: 'item-id', substituteItemId: 'sub-id' },
          'user-id',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
