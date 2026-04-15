import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ProcurementService } from '../../src/modules/procurement/procurement.service';
import { PurchaseRequest, PurchaseRequestStatus } from '../../src/modules/procurement/purchase-request.entity';
import { PurchaseRequestItem } from '../../src/modules/procurement/purchase-request-item.entity';
import { RFQ, RFQStatus } from '../../src/modules/procurement/rfq.entity';
import { RFQLine } from '../../src/modules/procurement/rfq-line.entity';
import { VendorQuote } from '../../src/modules/procurement/vendor-quote.entity';
import { Vendor } from '../../src/modules/procurement/vendor.entity';
import { PurchaseOrder, POStatus } from '../../src/modules/procurement/purchase-order.entity';
import { POLine } from '../../src/modules/procurement/po-line.entity';
import { POReceipt, ReceiptStatus } from '../../src/modules/procurement/po-receipt.entity';
import { POReceiptLine, InspectionResult } from '../../src/modules/procurement/po-receipt-line.entity';
import { PutAway } from '../../src/modules/procurement/put-away.entity';
import { Reconciliation, ReconciliationStatus } from '../../src/modules/procurement/reconciliation.entity';
import { InventoryLevel } from '../../src/modules/inventory/inventory-level.entity';
import { StockMovement } from '../../src/modules/inventory/stock-movement.entity';
import { AuditLogService } from '../../src/common/services/audit-log.service';
import { UserRole } from '../../src/modules/users/user.entity';

const mockRepo = () => ({
  create: jest.fn().mockImplementation((d) => ({ ...d })),
  save: jest.fn().mockImplementation((d) => Promise.resolve(Array.isArray(d) ? d : { id: 'test-id', ...d })),
  findOne: jest.fn().mockResolvedValue(null),
  find: jest.fn().mockResolvedValue([]),
  update: jest.fn().mockResolvedValue({}),
});

const mockAuditLog = () => ({ log: jest.fn().mockResolvedValue(undefined) });

describe('ProcurementService', () => {
  let service: ProcurementService;
  let prRepo: ReturnType<typeof mockRepo>;
  let priRepo: ReturnType<typeof mockRepo>;
  let rfqRepo: ReturnType<typeof mockRepo>;
  let rfqLineRepo: ReturnType<typeof mockRepo>;
  let quoteRepo: ReturnType<typeof mockRepo>;
  let vendorRepo: ReturnType<typeof mockRepo>;
  let poRepo: ReturnType<typeof mockRepo>;
  let poLineRepo: ReturnType<typeof mockRepo>;
  let receiptRepo: ReturnType<typeof mockRepo>;
  let receiptLineRepo: ReturnType<typeof mockRepo>;
  let putAwayRepo: ReturnType<typeof mockRepo>;
  let reconciliationRepo: ReturnType<typeof mockRepo>;
  let inventoryRepo: ReturnType<typeof mockRepo>;
  let movementRepo: ReturnType<typeof mockRepo>;
  let audit: ReturnType<typeof mockAuditLog>;

  beforeEach(async () => {
    prRepo = mockRepo();
    priRepo = mockRepo();
    rfqRepo = mockRepo();
    rfqLineRepo = mockRepo();
    quoteRepo = mockRepo();
    vendorRepo = mockRepo();
    poRepo = mockRepo();
    poLineRepo = mockRepo();
    receiptRepo = mockRepo();
    receiptLineRepo = mockRepo();
    putAwayRepo = mockRepo();
    reconciliationRepo = mockRepo();
    inventoryRepo = mockRepo();
    movementRepo = mockRepo();
    audit = mockAuditLog();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcurementService,
        { provide: getRepositoryToken(PurchaseRequest), useValue: prRepo },
        { provide: getRepositoryToken(PurchaseRequestItem), useValue: priRepo },
        { provide: getRepositoryToken(RFQ), useValue: rfqRepo },
        { provide: getRepositoryToken(RFQLine), useValue: rfqLineRepo },
        { provide: getRepositoryToken(VendorQuote), useValue: quoteRepo },
        { provide: getRepositoryToken(Vendor), useValue: vendorRepo },
        { provide: getRepositoryToken(PurchaseOrder), useValue: poRepo },
        { provide: getRepositoryToken(POLine), useValue: poLineRepo },
        { provide: getRepositoryToken(POReceipt), useValue: receiptRepo },
        { provide: getRepositoryToken(POReceiptLine), useValue: receiptLineRepo },
        { provide: getRepositoryToken(PutAway), useValue: putAwayRepo },
        { provide: getRepositoryToken(Reconciliation), useValue: reconciliationRepo },
        { provide: getRepositoryToken(InventoryLevel), useValue: inventoryRepo },
        { provide: getRepositoryToken(StockMovement), useValue: movementRepo },
        { provide: AuditLogService, useValue: audit },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get<ProcurementService>(ProcurementService);
  });

  // ── Purchase Requests ──────────────────────────────────────────────

  describe('createRequest', () => {
    it('creates a PR with items and logs audit', async () => {
      prRepo.findOne.mockResolvedValue({ id: 'pr-1', items: [] });
      const res = await service.createRequest(
        { justification: 'need it', items: [{ itemId: 'i1', quantity: 2, unitOfMeasure: 'box' }] } as any,
        'u1',
        '1.1.1.1',
      );
      expect(prRepo.save).toHaveBeenCalled();
      expect(priRepo.save).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalled();
      expect(res).toBeDefined();
    });
  });

  describe('getRequests', () => {
    it('employee sees only own', async () => {
      await service.getRequests({ id: 'u1', role: UserRole.EMPLOYEE });
      expect(prRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { requesterId: 'u1' } }));
    });
    it('admin sees all', async () => {
      await service.getRequests({ id: 'u1', role: UserRole.ADMIN });
      expect(prRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });
  });

  describe('submitRequest', () => {
    it('submits DRAFT request', async () => {
      prRepo.findOne.mockResolvedValue({ id: 'pr1', requesterId: 'u1', status: PurchaseRequestStatus.DRAFT, items: [] });
      const res = await service.submitRequest('pr1', 'u1', UserRole.EMPLOYEE);
      expect(res.status).toBe(PurchaseRequestStatus.SUBMITTED);
    });
    it('throws NotFound when PR missing', async () => {
      prRepo.findOne.mockResolvedValue(null);
      await expect(service.submitRequest('x', 'u1')).rejects.toThrow(NotFoundException);
    });
    it('throws Forbidden when owner mismatch and not admin', async () => {
      prRepo.findOne.mockResolvedValue({ id: 'pr1', requesterId: 'other', status: PurchaseRequestStatus.DRAFT, items: [] });
      await expect(service.submitRequest('pr1', 'u1', UserRole.EMPLOYEE)).rejects.toThrow(ForbiddenException);
    });
    it('admin bypasses ownership', async () => {
      prRepo.findOne.mockResolvedValue({ id: 'pr1', requesterId: 'other', status: PurchaseRequestStatus.DRAFT, items: [] });
      await service.submitRequest('pr1', 'admin', UserRole.ADMIN);
      expect(prRepo.save).toHaveBeenCalled();
    });
    it('supervisor bypasses ownership', async () => {
      prRepo.findOne.mockResolvedValue({ id: 'pr1', requesterId: 'other', status: PurchaseRequestStatus.DRAFT, items: [] });
      await service.submitRequest('pr1', 'sup', UserRole.SUPERVISOR);
      expect(prRepo.save).toHaveBeenCalled();
    });
    it('throws BadRequest for non-DRAFT status', async () => {
      prRepo.findOne.mockResolvedValue({ id: 'pr1', requesterId: 'u1', status: PurchaseRequestStatus.SUBMITTED, items: [] });
      await expect(service.submitRequest('pr1', 'u1', UserRole.EMPLOYEE)).rejects.toThrow(BadRequestException);
    });
  });

  describe('approveRequest', () => {
    it('approves SUBMITTED', async () => {
      prRepo.findOne.mockResolvedValue({ id: 'pr1', status: PurchaseRequestStatus.SUBMITTED, items: [] });
      const res = await service.approveRequest('pr1', 'u1');
      expect(res.status).toBe(PurchaseRequestStatus.APPROVED);
    });
    it('throws for non-SUBMITTED', async () => {
      prRepo.findOne.mockResolvedValue({ id: 'pr1', status: PurchaseRequestStatus.DRAFT, items: [] });
      await expect(service.approveRequest('pr1', 'u1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('rejectRequest', () => {
    it('rejects SUBMITTED', async () => {
      prRepo.findOne.mockResolvedValue({ id: 'pr1', status: PurchaseRequestStatus.SUBMITTED, items: [] });
      const res = await service.rejectRequest('pr1', 'u1');
      expect(res.status).toBe(PurchaseRequestStatus.REJECTED);
    });
    it('throws for non-SUBMITTED', async () => {
      prRepo.findOne.mockResolvedValue({ id: 'pr1', status: PurchaseRequestStatus.APPROVED, items: [] });
      await expect(service.rejectRequest('pr1', 'u1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('approveSubstitute', () => {
    it('saves substitute', async () => {
      prRepo.findOne.mockResolvedValue({ id: 'pr1', items: [] });
      priRepo.findOne.mockResolvedValue({ id: 'item1', purchaseRequestId: 'pr1' });
      const res = await service.approveSubstitute('pr1', { purchaseRequestItemId: 'item1', substituteItemId: 'sub1' } as any, 'u1');
      expect(priRepo.save).toHaveBeenCalled();
      expect(res).toBeDefined();
    });
    it('throws NotFound when item missing', async () => {
      prRepo.findOne.mockResolvedValue({ id: 'pr1', items: [] });
      priRepo.findOne.mockResolvedValue(null);
      await expect(
        service.approveSubstitute('pr1', { purchaseRequestItemId: 'x', substituteItemId: 's' } as any, 'u1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── RFQ ────────────────────────────────────────────────────────────

  describe('createRFQ', () => {
    it('creates RFQ from APPROVED PR with due date', async () => {
      prRepo.findOne.mockResolvedValue({ id: 'pr1', status: PurchaseRequestStatus.APPROVED, items: [] });
      rfqRepo.findOne.mockResolvedValue({ id: 'rfq1', lines: [] });
      const res = await service.createRFQ(
        { purchaseRequestId: 'pr1', dueDate: '2026-06-01', lines: [{ itemId: 'i1', quantity: 10, unitOfMeasure: 'box' }] } as any,
        'u1',
      );
      expect(rfqRepo.save).toHaveBeenCalled();
      expect(prRepo.update).toHaveBeenCalledWith('pr1', { status: PurchaseRequestStatus.CONVERTED });
      expect(res).toBeDefined();
    });
    it('creates RFQ without dueDate', async () => {
      prRepo.findOne.mockResolvedValue({ id: 'pr1', status: PurchaseRequestStatus.APPROVED, items: [] });
      rfqRepo.findOne.mockResolvedValue({ id: 'rfq1' });
      await service.createRFQ(
        { purchaseRequestId: 'pr1', lines: [{ itemId: 'i1', quantity: 10, unitOfMeasure: 'box' }] } as any,
        'u1',
      );
      expect(rfqRepo.save).toHaveBeenCalled();
    });
    it('throws if PR not APPROVED', async () => {
      prRepo.findOne.mockResolvedValue({ id: 'pr1', status: PurchaseRequestStatus.DRAFT, items: [] });
      await expect(
        service.createRFQ({ purchaseRequestId: 'pr1', lines: [] } as any, 'u1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('addVendorQuote', () => {
    it('adds quote to DRAFT RFQ and moves to QUOTED', async () => {
      rfqRepo.findOne.mockResolvedValue({ id: 'rfq1', status: RFQStatus.DRAFT });
      rfqLineRepo.findOne.mockResolvedValue({ id: 'l1', rfqId: 'rfq1' });
      await service.addVendorQuote('rfq1', { rfqLineId: 'l1', vendorId: 'v1', unitPrice: 10, leadTimeDays: 3, validUntil: '2026-06-01' } as any, 'u1');
      expect(rfqRepo.update).toHaveBeenCalledWith('rfq1', { status: RFQStatus.QUOTED });
    });
    it('adds quote to SENT RFQ without status change', async () => {
      rfqRepo.findOne.mockResolvedValue({ id: 'rfq1', status: RFQStatus.SENT });
      rfqLineRepo.findOne.mockResolvedValue({ id: 'l1', rfqId: 'rfq1' });
      await service.addVendorQuote('rfq1', { rfqLineId: 'l1', vendorId: 'v1', unitPrice: 10, leadTimeDays: 3 } as any, 'u1');
      expect(rfqRepo.update).not.toHaveBeenCalled();
    });
    it('throws if RFQ missing', async () => {
      rfqRepo.findOne.mockResolvedValue(null);
      await expect(service.addVendorQuote('x', { rfqLineId: 'l1', vendorId: 'v1', unitPrice: 1, leadTimeDays: 1 } as any, 'u1'))
        .rejects.toThrow(NotFoundException);
    });
    it('throws if RFQ in wrong status', async () => {
      rfqRepo.findOne.mockResolvedValue({ id: 'rfq1', status: RFQStatus.AWARDED });
      await expect(service.addVendorQuote('rfq1', { rfqLineId: 'l1', vendorId: 'v1', unitPrice: 1, leadTimeDays: 1 } as any, 'u1'))
        .rejects.toThrow(BadRequestException);
    });
    it('throws if line does not belong to RFQ', async () => {
      rfqRepo.findOne.mockResolvedValue({ id: 'rfq1', status: RFQStatus.DRAFT });
      rfqLineRepo.findOne.mockResolvedValue({ id: 'l1', rfqId: 'other' });
      await expect(service.addVendorQuote('rfq1', { rfqLineId: 'l1', vendorId: 'v1', unitPrice: 1, leadTimeDays: 1 } as any, 'u1'))
        .rejects.toThrow(BadRequestException);
    });
    it('throws if line not found', async () => {
      rfqRepo.findOne.mockResolvedValue({ id: 'rfq1', status: RFQStatus.DRAFT });
      rfqLineRepo.findOne.mockResolvedValue(null);
      await expect(service.addVendorQuote('rfq1', { rfqLineId: 'l1', vendorId: 'v1', unitPrice: 1, leadTimeDays: 1 } as any, 'u1'))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('getRFQComparison', () => {
    it('returns comparison with lowest marked', async () => {
      rfqRepo.findOne.mockResolvedValue({
        id: 'rfq1',
        lines: [
          {
            id: 'l1', itemId: 'i1', item: { name: 'Gauze' }, quantity: 10, unitOfMeasure: 'box',
            vendorQuotes: [
              { vendorId: 'v1', vendor: { name: 'V1' }, unitPrice: 5, leadTimeDays: 3, validUntil: null, isSelected: false },
              { vendorId: 'v2', vendor: { name: 'V2' }, unitPrice: 10, leadTimeDays: 2, validUntil: null, isSelected: true },
            ],
          },
        ],
      });
      const res = await service.getRFQComparison('rfq1');
      expect(res.lines[0].quotes[0].isLowest).toBe(true);
      expect(res.lines[0].quotes[1].isLowest).toBe(false);
    });
    it('handles empty quotes and null relations', async () => {
      rfqRepo.findOne.mockResolvedValue({
        id: 'rfq1',
        lines: [{ id: 'l1', itemId: 'i1', item: null, quantity: 0, unitOfMeasure: 'box', vendorQuotes: [] }],
      });
      const res = await service.getRFQComparison('rfq1');
      expect(res.lines[0].itemName).toBe('Unknown Item');
    });
    it('handles missing vendor name', async () => {
      rfqRepo.findOne.mockResolvedValue({
        id: 'rfq1',
        lines: [{ id: 'l1', itemId: 'i1', item: { name: 'X' }, quantity: 1, unitOfMeasure: 'ea',
          vendorQuotes: [{ vendorId: 'v1', vendor: null, unitPrice: 1, leadTimeDays: 1, validUntil: null, isSelected: false }] }],
      });
      const res = await service.getRFQComparison('rfq1');
      expect(res.lines[0].quotes[0].vendorName).toBe('Unknown Vendor');
    });
    it('throws if RFQ missing', async () => {
      rfqRepo.findOne.mockResolvedValue(null);
      await expect(service.getRFQComparison('x')).rejects.toThrow(NotFoundException);
    });
  });

  // ── Purchase Orders ─────────────────────────────────────────────────

  describe('createPO', () => {
    it('creates PO from QUOTED RFQ', async () => {
      rfqRepo.findOne.mockResolvedValue({ id: 'rfq1', status: RFQStatus.QUOTED, lines: [{ itemId: 'i1' }] });
      poRepo.findOne.mockResolvedValue({ id: 'po1', lines: [] });
      const res = await service.createPO(
        { rfqId: 'rfq1', vendorId: 'v1', notes: 'n', lines: [{ itemId: 'i1', quantity: 5, unitPrice: 10, unitOfMeasure: 'box' }] } as any,
        'u1',
      );
      expect(poRepo.save).toHaveBeenCalled();
      expect(poRepo.update).toHaveBeenCalled();
      expect(poRepo.update.mock.calls.some((c: any[]) => c[1]?.totalAmount === 50)).toBe(true);
      expect(res).toBeDefined();
    });
    it('creates PO from AWARDED RFQ', async () => {
      rfqRepo.findOne.mockResolvedValue({ id: 'rfq1', status: RFQStatus.AWARDED, lines: [{ itemId: 'i1' }] });
      poRepo.findOne.mockResolvedValue({ id: 'po1' });
      await service.createPO(
        { rfqId: 'rfq1', vendorId: 'v1', lines: [{ itemId: 'i1', quantity: 1, unitPrice: 1, unitOfMeasure: 'box' }] } as any,
        'u1',
      );
      expect(poRepo.save).toHaveBeenCalled();
    });
    it('throws if RFQ missing', async () => {
      rfqRepo.findOne.mockResolvedValue(null);
      await expect(service.createPO({ rfqId: 'x', vendorId: 'v1', lines: [] } as any, 'u1'))
        .rejects.toThrow(BadRequestException);
    });
    it('throws if RFQ wrong status', async () => {
      rfqRepo.findOne.mockResolvedValue({ id: 'rfq1', status: RFQStatus.DRAFT, lines: [] });
      await expect(service.createPO({ rfqId: 'rfq1', vendorId: 'v1', lines: [] } as any, 'u1'))
        .rejects.toThrow(BadRequestException);
    });
    it('throws if PO line item not in RFQ', async () => {
      rfqRepo.findOne.mockResolvedValue({ id: 'rfq1', status: RFQStatus.QUOTED, lines: [{ itemId: 'i1' }] });
      await expect(
        service.createPO({ rfqId: 'rfq1', vendorId: 'v1', lines: [{ itemId: 'other', quantity: 1, unitPrice: 1, unitOfMeasure: 'box' }] } as any, 'u1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('approvePO', () => {
    it('approves DRAFT PO and sets price lock', async () => {
      poRepo.findOne.mockResolvedValue({ id: 'po1', status: POStatus.DRAFT });
      const res = await service.approvePO('po1', 'u1');
      expect(res.status).toBe(POStatus.APPROVED);
      expect(res.priceLockedUntil).toBeDefined();
    });
    it('throws if not DRAFT', async () => {
      poRepo.findOne.mockResolvedValue({ id: 'po1', status: POStatus.APPROVED });
      await expect(service.approvePO('po1', 'u1')).rejects.toThrow(BadRequestException);
    });
    it('throws NotFound if missing', async () => {
      poRepo.findOne.mockResolvedValue(null);
      await expect(service.approvePO('x', 'u1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePOLinePrice', () => {
    it('throws when price locked', async () => {
      poRepo.findOne.mockResolvedValue({ id: 'po1', priceLockedUntil: new Date(Date.now() + 10 * 86400000) });
      poLineRepo.findOne.mockResolvedValue({ id: 'l1', purchaseOrderId: 'po1', unitPrice: 10 });
      await expect(service.updatePOLinePrice('po1', 'l1', 15, 'u1')).rejects.toThrow(BadRequestException);
    });
    it('updates when lock expired', async () => {
      poRepo.findOne.mockResolvedValue({ id: 'po1', priceLockedUntil: new Date(Date.now() - 86400000) });
      poLineRepo.findOne.mockResolvedValue({ id: 'l1', purchaseOrderId: 'po1', unitPrice: 10 });
      await service.updatePOLinePrice('po1', 'l1', 15, 'u1');
      expect(poLineRepo.save).toHaveBeenCalled();
    });
    it('updates when no lock', async () => {
      poRepo.findOne.mockResolvedValue({ id: 'po1', priceLockedUntil: null });
      poLineRepo.findOne.mockResolvedValue({ id: 'l1', purchaseOrderId: 'po1', unitPrice: 10 });
      await service.updatePOLinePrice('po1', 'l1', 15, 'u1');
      expect(poLineRepo.save).toHaveBeenCalled();
    });
    it('throws when line missing', async () => {
      poRepo.findOne.mockResolvedValue({ id: 'po1', priceLockedUntil: null });
      poLineRepo.findOne.mockResolvedValue(null);
      await expect(service.updatePOLinePrice('po1', 'l1', 15, 'u1')).rejects.toThrow(NotFoundException);
    });
  });

  // ── Receiving ───────────────────────────────────────────────────────

  describe('receiveOrder', () => {
    const setupReceiveOrder = (poStatus: POStatus, linesBefore: any[], linesAfter: any[]) => {
      poRepo.findOne.mockResolvedValue({ id: 'po1', status: poStatus });
      receiptRepo.findOne.mockResolvedValue({ id: 'r1', lines: [] });
      poLineRepo.find.mockResolvedValueOnce(linesBefore).mockResolvedValueOnce(linesAfter);
    };
    it('receives from APPROVED, fully', async () => {
      setupReceiveOrder(
        POStatus.APPROVED,
        [{ id: 'l1', purchaseOrderId: 'po1', quantity: 10, receivedQuantity: 0 }],
        [{ id: 'l1', purchaseOrderId: 'po1', quantity: 10, receivedQuantity: 10 }],
      );
      await service.receiveOrder(
        'po1',
        { lines: [{ poLineId: 'l1', receivedQuantity: 10, lotNumber: 'lot1', expiryDate: '2026-12-31' }] } as any,
        'u1',
      );
      expect(poRepo.update).toHaveBeenCalledWith('po1', { status: POStatus.RECEIVED });
    });
    it('receives from SENT, partial', async () => {
      setupReceiveOrder(
        POStatus.SENT,
        [{ id: 'l1', purchaseOrderId: 'po1', quantity: 10, receivedQuantity: 0 }],
        [{ id: 'l1', purchaseOrderId: 'po1', quantity: 10, receivedQuantity: 5 }],
      );
      await service.receiveOrder('po1', { lines: [{ poLineId: 'l1', receivedQuantity: 5 }] } as any, 'u1');
      expect(poRepo.update).toHaveBeenCalledWith('po1', { status: POStatus.PARTIALLY_RECEIVED });
    });
    it('receives from PARTIALLY_RECEIVED state', async () => {
      setupReceiveOrder(
        POStatus.PARTIALLY_RECEIVED,
        [{ id: 'l1', purchaseOrderId: 'po1', quantity: 10, receivedQuantity: 5 }],
        [{ id: 'l1', purchaseOrderId: 'po1', quantity: 10, receivedQuantity: 10 }],
      );
      await service.receiveOrder('po1', { lines: [{ poLineId: 'l1', receivedQuantity: 5 }] } as any, 'u1');
      expect(poRepo.update).toHaveBeenCalledWith('po1', { status: POStatus.RECEIVED });
    });
    it('skips unknown lines (no match)', async () => {
      setupReceiveOrder(
        POStatus.APPROVED,
        [{ id: 'l1', purchaseOrderId: 'po1', quantity: 10, receivedQuantity: 0 }],
        [{ id: 'l1', purchaseOrderId: 'po1', quantity: 10, receivedQuantity: 0 }],
      );
      await service.receiveOrder('po1', { lines: [{ poLineId: 'other', receivedQuantity: 5 }] } as any, 'u1');
      expect(poRepo.update).toHaveBeenCalledWith('po1', { status: POStatus.APPROVED });
    });
    it('throws if PO not receivable', async () => {
      poRepo.findOne.mockResolvedValue({ id: 'po1', status: POStatus.DRAFT });
      await expect(service.receiveOrder('po1', { lines: [] } as any, 'u1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('inspectReceipt', () => {
    it('marks receipt PASSED when all passed', async () => {
      receiptRepo.findOne.mockResolvedValue({ id: 'r1', lines: [{ id: 'rl1' }] });
      receiptLineRepo.find.mockResolvedValue([{ id: 'rl1', inspectionResult: InspectionResult.PASSED }]);
      await service.inspectReceipt('r1', { lines: [{ receiptLineId: 'rl1', result: InspectionResult.PASSED }] } as any, 'u1');
      expect(receiptRepo.update).toHaveBeenCalledWith('r1', { status: ReceiptStatus.PASSED });
    });
    it('marks FAILED when any failed', async () => {
      receiptRepo.findOne.mockResolvedValue({ id: 'r1', lines: [{ id: 'rl1' }] });
      receiptLineRepo.find.mockResolvedValue([
        { id: 'rl1', inspectionResult: InspectionResult.FAILED },
        { id: 'rl2', inspectionResult: InspectionResult.PASSED },
      ]);
      await service.inspectReceipt('r1', { lines: [{ receiptLineId: 'rl1', result: InspectionResult.FAILED }] } as any, 'u1');
      expect(receiptRepo.update).toHaveBeenCalledWith('r1', { status: ReceiptStatus.FAILED });
    });
    it('marks INSPECTING when mixed pending', async () => {
      receiptRepo.findOne.mockResolvedValue({ id: 'r1', lines: [{ id: 'rl1' }] });
      receiptLineRepo.find.mockResolvedValue([
        { id: 'rl1', inspectionResult: InspectionResult.PASSED },
        { id: 'rl2', inspectionResult: InspectionResult.PENDING },
      ]);
      await service.inspectReceipt('r1', { lines: [{ receiptLineId: 'rl1', result: InspectionResult.PASSED }] } as any, 'u1');
      expect(receiptRepo.update).toHaveBeenCalledWith('r1', { status: ReceiptStatus.INSPECTING });
    });
    it('skips unknown receipt lines', async () => {
      receiptRepo.findOne.mockResolvedValue({ id: 'r1', lines: [{ id: 'rl1' }] });
      receiptLineRepo.find.mockResolvedValue([{ id: 'rl1', inspectionResult: InspectionResult.PASSED }]);
      await service.inspectReceipt('r1', { lines: [{ receiptLineId: 'nope', result: InspectionResult.PASSED }] } as any, 'u1');
      expect(receiptRepo.update).toHaveBeenCalled();
    });
    it('throws NotFound if missing', async () => {
      receiptRepo.findOne.mockResolvedValue(null);
      await expect(service.inspectReceipt('x', { lines: [] } as any, 'u1')).rejects.toThrow(NotFoundException);
    });
  });

  // ── Put-Away ────────────────────────────────────────────────────────

  describe('putAway', () => {
    it('stores items and updates inventory (existing level)', async () => {
      receiptRepo.findOne.mockResolvedValue({ id: 'r1', lines: [{ id: 'rl1', poLineId: 'pl1' }] });
      poLineRepo.findOne.mockResolvedValue({ id: 'pl1', itemId: 'i1' });
      inventoryRepo.findOne.mockResolvedValue({ id: 'lvl1', itemId: 'i1', quantityOnHand: 5 });
      await service.putAway(
        'r1',
        { lines: [{ receiptLineId: 'rl1', location: 'A1', quantityStored: 10 }] } as any,
        'u1',
      );
      expect(putAwayRepo.save).toHaveBeenCalled();
      expect(inventoryRepo.save).toHaveBeenCalled();
      expect(movementRepo.save).toHaveBeenCalled();
    });
    it('creates new inventory level if missing', async () => {
      receiptRepo.findOne.mockResolvedValue({ id: 'r1', lines: [{ id: 'rl1', poLineId: 'pl1' }] });
      poLineRepo.findOne.mockResolvedValue({ id: 'pl1', itemId: 'i1' });
      inventoryRepo.findOne.mockResolvedValue(null);
      await service.putAway('r1', { lines: [{ receiptLineId: 'rl1', location: 'A1', quantityStored: 5 }] } as any, 'u1');
      expect(inventoryRepo.create).toHaveBeenCalled();
    });
    it('skips unknown receipt lines', async () => {
      receiptRepo.findOne.mockResolvedValue({ id: 'r1', lines: [{ id: 'rl1', poLineId: 'pl1' }] });
      await service.putAway('r1', { lines: [{ receiptLineId: 'nope', location: 'A1', quantityStored: 5 }] } as any, 'u1');
      expect(putAwayRepo.save).not.toHaveBeenCalled();
    });
    it('skips when poLine missing', async () => {
      receiptRepo.findOne.mockResolvedValue({ id: 'r1', lines: [{ id: 'rl1', poLineId: 'pl1' }] });
      poLineRepo.findOne.mockResolvedValue(null);
      await service.putAway('r1', { lines: [{ receiptLineId: 'rl1', location: 'A1', quantityStored: 5 }] } as any, 'u1');
      expect(inventoryRepo.save).not.toHaveBeenCalled();
    });
    it('throws NotFound when receipt missing', async () => {
      receiptRepo.findOne.mockResolvedValue(null);
      await expect(service.putAway('x', { lines: [] } as any, 'u1')).rejects.toThrow(NotFoundException);
    });
  });

  // ── Reconciliation ──────────────────────────────────────────────────

  describe('reconcileOrder', () => {
    it('creates matched reconciliation when all match', async () => {
      poRepo.findOne.mockResolvedValue({ id: 'po1' });
      poLineRepo.find.mockResolvedValue([{ itemId: 'i1', quantity: 10, receivedQuantity: 10 }]);
      const res = await service.reconcileOrder('po1', 'u1');
      expect(res.status).toBe(ReconciliationStatus.MATCHED);
    });
    it('creates discrepancy reconciliation when mismatch', async () => {
      poRepo.findOne.mockResolvedValue({ id: 'po1' });
      poLineRepo.find.mockResolvedValue([{ itemId: 'i1', quantity: 10, receivedQuantity: 7 }]);
      const res = await service.reconcileOrder('po1', 'u1');
      expect(res.status).toBe(ReconciliationStatus.DISCREPANCY);
    });
  });

  // ── Query helpers ───────────────────────────────────────────────────

  describe('query helpers', () => {
    it('getPO returns PO', async () => {
      poRepo.findOne.mockResolvedValue({ id: 'po1' });
      expect(await service.getPO('po1')).toBeDefined();
    });
    it('getPO throws', async () => {
      poRepo.findOne.mockResolvedValue(null);
      await expect(service.getPO('x')).rejects.toThrow(NotFoundException);
    });
    it('getPOs returns list', async () => {
      await service.getPOs();
      expect(poRepo.find).toHaveBeenCalled();
    });
    it('getRFQs returns list', async () => {
      await service.getRFQs();
      expect(rfqRepo.find).toHaveBeenCalled();
    });
    it('getRFQ returns rfq', async () => {
      rfqRepo.findOne.mockResolvedValue({ id: 'rfq1' });
      expect(await service.getRFQ('rfq1')).toBeDefined();
    });
    it('getRFQ throws', async () => {
      rfqRepo.findOne.mockResolvedValue(null);
      await expect(service.getRFQ('x')).rejects.toThrow(NotFoundException);
    });
    it('getVendors returns list', async () => {
      await service.getVendors();
      expect(vendorRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true } }));
    });
    it('createVendor saves', async () => {
      await service.createVendor({ name: 'V' });
      expect(vendorRepo.save).toHaveBeenCalled();
    });
    it('updateVendor saves', async () => {
      vendorRepo.findOne.mockResolvedValue({ id: 'v1', name: 'X' });
      await service.updateVendor('v1', { name: 'Y' });
      expect(vendorRepo.save).toHaveBeenCalled();
    });
    it('updateVendor throws when missing', async () => {
      vendorRepo.findOne.mockResolvedValue(null);
      await expect(service.updateVendor('x', { name: 'Y' })).rejects.toThrow(NotFoundException);
    });
  });
});
