import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PurchaseRequest, PurchaseRequestStatus } from './purchase-request.entity';
import { PurchaseRequestItem } from './purchase-request-item.entity';
import { RFQ, RFQStatus } from './rfq.entity';
import { RFQLine } from './rfq-line.entity';
import { VendorQuote } from './vendor-quote.entity';
import { PurchaseOrder, POStatus } from './purchase-order.entity';
import { POLine } from './po-line.entity';
import { POReceipt, ReceiptStatus } from './po-receipt.entity';
import { POReceiptLine, InspectionResult } from './po-receipt-line.entity';
import { PutAway } from './put-away.entity';
import { Reconciliation, ReconciliationStatus } from './reconciliation.entity';
import { InventoryLevel } from '../inventory/inventory-level.entity';
import { StockMovement, MovementType } from '../inventory/stock-movement.entity';
import { UserRole } from '../users/user.entity';
import { AuditLogService } from '../../common/services/audit-log.service';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto';
import { CreateRFQDto } from './dto/create-rfq.dto';
import { AddVendorQuoteDto } from './dto/add-vendor-quote.dto';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceiveOrderDto } from './dto/receive-order.dto';
import { InspectReceiptDto } from './dto/inspect-receipt.dto';
import { PutAwayDto } from './dto/put-away.dto';
import { ApproveSubstituteDto } from './dto/substitute.dto';

// 30-day price lock in milliseconds
const PRICE_LOCK_DAYS = 30;

@Injectable()
export class ProcurementService {
  constructor(
    @InjectRepository(PurchaseRequest) private readonly prRepo: Repository<PurchaseRequest>,
    @InjectRepository(PurchaseRequestItem) private readonly priRepo: Repository<PurchaseRequestItem>,
    @InjectRepository(RFQ) private readonly rfqRepo: Repository<RFQ>,
    @InjectRepository(RFQLine) private readonly rfqLineRepo: Repository<RFQLine>,
    @InjectRepository(VendorQuote) private readonly quoteRepo: Repository<VendorQuote>,
    @InjectRepository(PurchaseOrder) private readonly poRepo: Repository<PurchaseOrder>,
    @InjectRepository(POLine) private readonly poLineRepo: Repository<POLine>,
    @InjectRepository(POReceipt) private readonly receiptRepo: Repository<POReceipt>,
    @InjectRepository(POReceiptLine) private readonly receiptLineRepo: Repository<POReceiptLine>,
    @InjectRepository(PutAway) private readonly putAwayRepo: Repository<PutAway>,
    @InjectRepository(Reconciliation) private readonly reconciliationRepo: Repository<Reconciliation>,
    @InjectRepository(InventoryLevel) private readonly inventoryRepo: Repository<InventoryLevel>,
    @InjectRepository(StockMovement) private readonly movementRepo: Repository<StockMovement>,
    private readonly auditLog: AuditLogService,
    private readonly dataSource: DataSource,
  ) {}

  // ── Purchase Requests ──────────────────────────────────────────────────

  async createRequest(
    dto: CreatePurchaseRequestDto,
    userId: string,
    ip?: string,
  ): Promise<PurchaseRequest> {
    const requestNumber = `PR-${Date.now()}`;
    const pr = this.prRepo.create({
      requestNumber,
      requesterId: userId,
      justification: dto.justification,
      status: PurchaseRequestStatus.DRAFT,
    });
    await this.prRepo.save(pr);

    const items = dto.items.map((i) =>
      this.priRepo.create({
        purchaseRequestId: pr.id,
        itemId: i.itemId,
        quantity: i.quantity,
        unitOfMeasure: i.unitOfMeasure,
        notes: i.notes,
      }),
    );
    await this.priRepo.save(items);

    await this.auditLog.log({
      userId,
      action: 'CREATE',
      entityType: 'PurchaseRequest',
      entityId: pr.id,
      after: { requestNumber, status: PurchaseRequestStatus.DRAFT },
      ip,
    });
    return this.prRepo.findOne({ where: { id: pr.id }, relations: ['items'] }) as Promise<PurchaseRequest>;
  }

  async getRequests(user: { id: string; role: UserRole }) {
    // Employees see only their own; supervisors/admins see all
    const where =
      user.role === UserRole.EMPLOYEE ? { requesterId: user.id } : {};
    return this.prRepo.find({
      where,
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
  }

  async submitRequest(id: string, userId: string, userRole?: UserRole, ip?: string) {
    const pr = await this.findPROrFail(id);
    this.assertOwnerOrAdmin(pr.requesterId, userId, userRole);
    if (pr.status !== PurchaseRequestStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT requests can be submitted');
    }
    const before = { status: pr.status };
    pr.status = PurchaseRequestStatus.SUBMITTED;
    await this.prRepo.save(pr);
    await this.auditLog.log({
      userId, action: 'SUBMIT', entityType: 'PurchaseRequest',
      entityId: pr.id, before, after: { status: pr.status }, ip,
    });
    return pr;
  }

  async approveRequest(id: string, userId: string, ip?: string) {
    const pr = await this.findPROrFail(id);
    if (pr.status !== PurchaseRequestStatus.SUBMITTED) {
      throw new BadRequestException('Only SUBMITTED requests can be approved');
    }
    const before = { status: pr.status };
    pr.status = PurchaseRequestStatus.APPROVED;
    pr.approvedById = userId;
    pr.approvedAt = new Date();
    await this.prRepo.save(pr);
    await this.auditLog.log({
      userId, action: 'APPROVE', entityType: 'PurchaseRequest',
      entityId: pr.id, before, after: { status: pr.status }, ip,
    });
    return pr;
  }

  async rejectRequest(id: string, userId: string, ip?: string) {
    const pr = await this.findPROrFail(id);
    if (pr.status !== PurchaseRequestStatus.SUBMITTED) {
      throw new BadRequestException('Only SUBMITTED requests can be rejected');
    }
    const before = { status: pr.status };
    pr.status = PurchaseRequestStatus.REJECTED;
    await this.prRepo.save(pr);
    await this.auditLog.log({
      userId, action: 'REJECT', entityType: 'PurchaseRequest',
      entityId: pr.id, before, after: { status: pr.status }, ip,
    });
    return pr;
  }

  async approveSubstitute(id: string, dto: ApproveSubstituteDto, userId: string, ip?: string) {
    const pr = await this.findPROrFail(id);
    const item = await this.priRepo.findOne({ where: { id: dto.purchaseRequestItemId, purchaseRequestId: id } });
    if (!item) throw new NotFoundException('Purchase request item not found');

    item.substituteItemId = dto.substituteItemId;
    await this.priRepo.save(item);

    await this.auditLog.log({
      userId, action: 'APPROVE_SUBSTITUTE', entityType: 'PurchaseRequestItem',
      entityId: item.id, after: { substituteItemId: dto.substituteItemId }, ip,
    });
    return item;
  }

  // ── RFQ ────────────────────────────────────────────────────────────────

  async createRFQ(dto: CreateRFQDto, userId: string, ip?: string): Promise<RFQ> {
    const pr = await this.findPROrFail(dto.purchaseRequestId);
    if (pr.status !== PurchaseRequestStatus.APPROVED) {
      throw new BadRequestException('RFQ can only be created from APPROVED purchase requests');
    }

    const rfqNumber = `RFQ-${Date.now()}`;
    const rfq = this.rfqRepo.create({
      rfqNumber,
      purchaseRequestId: pr.id,
      createdById: userId,
      status: RFQStatus.DRAFT,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
    });
    await this.rfqRepo.save(rfq);

    const lines = dto.lines.map((l) =>
      this.rfqLineRepo.create({
        rfqId: rfq.id,
        itemId: l.itemId,
        quantity: l.quantity,
        unitOfMeasure: l.unitOfMeasure,
      }),
    );
    await this.rfqLineRepo.save(lines);

    // Mark PR as converted
    await this.prRepo.update(pr.id, { status: PurchaseRequestStatus.CONVERTED });

    await this.auditLog.log({
      userId, action: 'CREATE', entityType: 'RFQ', entityId: rfq.id,
      after: { rfqNumber, purchaseRequestId: pr.id }, ip,
    });
    return this.rfqRepo.findOne({ where: { id: rfq.id }, relations: ['lines'] }) as Promise<RFQ>;
  }

  async addVendorQuote(rfqId: string, dto: AddVendorQuoteDto, userId: string, ip?: string) {
    const rfq = await this.rfqRepo.findOne({ where: { id: rfqId } });
    if (!rfq) throw new NotFoundException('RFQ not found');
    if (![RFQStatus.DRAFT, RFQStatus.SENT].includes(rfq.status)) {
      throw new BadRequestException('Quotes can only be added to DRAFT or SENT RFQs');
    }

    const quote = this.quoteRepo.create({
      rfqLineId: dto.rfqLineId,
      vendorId: dto.vendorId,
      unitPrice: dto.unitPrice,
      leadTimeDays: dto.leadTimeDays,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      notes: dto.notes,
    });
    await this.quoteRepo.save(quote);

    if (rfq.status === RFQStatus.DRAFT) {
      await this.rfqRepo.update(rfqId, { status: RFQStatus.QUOTED });
    }

    await this.auditLog.log({
      userId, action: 'ADD_QUOTE', entityType: 'VendorQuote', entityId: quote.id,
      after: { rfqLineId: dto.rfqLineId, vendorId: dto.vendorId, unitPrice: dto.unitPrice }, ip,
    });
    return quote;
  }

  async getRFQComparison(rfqId: string) {
    const rfq = await this.rfqRepo.findOne({
      where: { id: rfqId },
      relations: ['lines', 'lines.item', 'lines.vendorQuotes', 'lines.vendorQuotes.vendor'],
    });
    if (!rfq) throw new NotFoundException('RFQ not found');

    return {
      rfq,
      lines: rfq.lines.map((line) => ({
        item: line.item,
        quantity: line.quantity,
        unitOfMeasure: line.unitOfMeasure,
        quotes: line.vendorQuotes.map((q) => ({
          vendor: q.vendor,
          unitPrice: Number(q.unitPrice),
          totalPrice: Number(q.unitPrice) * Number(line.quantity),
          leadTimeDays: q.leadTimeDays,
          validUntil: q.validUntil,
          isSelected: q.isSelected,
        })),
      })),
    };
  }

  // ── Purchase Orders ─────────────────────────────────────────────────────

  async createPO(dto: CreatePurchaseOrderDto, userId: string, ip?: string): Promise<PurchaseOrder> {
    const poNumber = `PO-${Date.now()}`;
    const po = this.poRepo.create({
      poNumber,
      rfqId: dto.rfqId ?? null,
      vendorId: dto.vendorId,
      createdById: userId,
      status: POStatus.DRAFT,
      notes: dto.notes,
    });
    await this.poRepo.save(po);

    let total = 0;
    const lines = dto.lines.map((l) => {
      total += l.quantity * l.unitPrice;
      return this.poLineRepo.create({
        purchaseOrderId: po.id,
        itemId: l.itemId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        unitOfMeasure: l.unitOfMeasure,
      });
    });
    await this.poLineRepo.save(lines);
    await this.poRepo.update(po.id, { totalAmount: total });

    await this.auditLog.log({
      userId, action: 'CREATE', entityType: 'PurchaseOrder', entityId: po.id,
      after: { poNumber, vendorId: dto.vendorId, status: POStatus.DRAFT }, ip,
    });
    return this.poRepo.findOne({ where: { id: po.id }, relations: ['lines'] }) as Promise<PurchaseOrder>;
  }

  async approvePO(id: string, userId: string, ip?: string): Promise<PurchaseOrder> {
    const po = await this.findPOOrFail(id);
    if (po.status !== POStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT purchase orders can be approved');
    }
    const before = { status: po.status };
    const now = new Date();
    const priceLockedUntil = new Date(now.getTime() + PRICE_LOCK_DAYS * 24 * 60 * 60 * 1000);

    po.status = POStatus.APPROVED;
    po.approvedById = userId;
    po.approvedAt = now;
    po.priceLockedUntil = priceLockedUntil;
    await this.poRepo.save(po);

    await this.auditLog.log({
      userId, action: 'APPROVE', entityType: 'PurchaseOrder', entityId: po.id,
      before, after: { status: po.status, priceLockedUntil }, ip,
    });
    return po;
  }

  async updatePOLinePrice(
    poId: string, lineId: string, newPrice: number, userId: string, ip?: string,
  ) {
    const po = await this.findPOOrFail(poId);
    // Enforce 30-day price lock
    if (po.priceLockedUntil && new Date() < po.priceLockedUntil) {
      throw new BadRequestException(
        `Price is locked until ${po.priceLockedUntil.toISOString()} (30-day lock)`,
      );
    }
    const line = await this.poLineRepo.findOne({ where: { id: lineId, purchaseOrderId: poId } });
    if (!line) throw new NotFoundException('PO line not found');
    const before = { unitPrice: line.unitPrice };
    line.unitPrice = newPrice;
    await this.poLineRepo.save(line);
    await this.auditLog.log({
      userId, action: 'UPDATE_PRICE', entityType: 'POLine', entityId: lineId,
      before, after: { unitPrice: newPrice }, ip,
    });
    return line;
  }

  // ── Receiving ───────────────────────────────────────────────────────────

  async receiveOrder(poId: string, dto: ReceiveOrderDto, userId: string, ip?: string) {
    const po = await this.findPOOrFail(poId);
    if (![POStatus.APPROVED, POStatus.SENT, POStatus.PARTIALLY_RECEIVED].includes(po.status)) {
      throw new BadRequestException('Purchase order cannot be received in current status');
    }

    const receipt = this.receiptRepo.create({
      purchaseOrderId: po.id,
      receivedById: userId,
      status: ReceiptStatus.PENDING,
      notes: dto.notes,
    });
    await this.receiptRepo.save(receipt);

    const receiptLines = dto.lines.map((l) =>
      this.receiptLineRepo.create({
        receiptId: receipt.id,
        poLineId: l.poLineId,
        receivedQuantity: l.receivedQuantity,
        inspectionResult: InspectionResult.PENDING,
        lotNumber: l.lotNumber,
        expiryDate: l.expiryDate ? new Date(l.expiryDate) : null,
      }),
    );
    await this.receiptLineRepo.save(receiptLines);

    // Update PO line received quantities and PO status
    await this.updatePOReceiveStatus(po.id, dto.lines);

    await this.auditLog.log({
      userId, action: 'RECEIVE', entityType: 'POReceipt', entityId: receipt.id,
      after: { purchaseOrderId: po.id, lineCount: dto.lines.length }, ip,
    });
    return this.receiptRepo.findOne({ where: { id: receipt.id }, relations: ['lines'] });
  }

  private async updatePOReceiveStatus(poId: string, lines: { poLineId: string; receivedQuantity: number }[]) {
    const poLines = await this.poLineRepo.find({ where: { purchaseOrderId: poId } });

    for (const rl of lines) {
      const poLine = poLines.find((l) => l.id === rl.poLineId);
      if (!poLine) continue;
      const newReceived = Number(poLine.receivedQuantity) + Number(rl.receivedQuantity);
      const remaining = Number(poLine.quantity) - newReceived;
      await this.poLineRepo.update(poLine.id, {
        receivedQuantity: newReceived,
        backorderQuantity: remaining > 0 ? remaining : 0,
      });
    }

    const updatedLines = await this.poLineRepo.find({ where: { purchaseOrderId: poId } });
    const allReceived = updatedLines.every(
      (l) => Number(l.receivedQuantity) >= Number(l.quantity),
    );
    const anyReceived = updatedLines.some((l) => Number(l.receivedQuantity) > 0);

    const newStatus = allReceived
      ? POStatus.RECEIVED
      : anyReceived
      ? POStatus.PARTIALLY_RECEIVED
      : POStatus.APPROVED;

    await this.poRepo.update(poId, { status: newStatus });
  }

  async inspectReceipt(receiptId: string, dto: InspectReceiptDto, userId: string, ip?: string) {
    const receipt = await this.receiptRepo.findOne({
      where: { id: receiptId },
      relations: ['lines'],
    });
    if (!receipt) throw new NotFoundException('Receipt not found');

    for (const inspectLine of dto.lines) {
      const line = receipt.lines.find((l) => l.id === inspectLine.receiptLineId);
      if (!line) continue;
      await this.receiptLineRepo.update(line.id, {
        inspectionResult: inspectLine.result,
        inspectionNotes: inspectLine.notes,
      });
    }

    // Determine overall receipt status
    const updatedLines = await this.receiptLineRepo.find({ where: { receiptId } });
    const allPassed = updatedLines.every((l) => l.inspectionResult === InspectionResult.PASSED);
    const anyFailed = updatedLines.some((l) => l.inspectionResult === InspectionResult.FAILED);

    const newStatus = anyFailed
      ? ReceiptStatus.FAILED
      : allPassed
      ? ReceiptStatus.PASSED
      : ReceiptStatus.INSPECTING;

    await this.receiptRepo.update(receiptId, { status: newStatus });

    await this.auditLog.log({
      userId, action: 'INSPECT', entityType: 'POReceipt', entityId: receiptId,
      after: { status: newStatus }, ip,
    });
    return this.receiptRepo.findOne({ where: { id: receiptId }, relations: ['lines'] });
  }

  // ── Put-Away ────────────────────────────────────────────────────────────

  async putAway(receiptId: string, dto: PutAwayDto, userId: string, ip?: string) {
    const receipt = await this.receiptRepo.findOne({
      where: { id: receiptId },
      relations: ['lines'],
    });
    if (!receipt) throw new NotFoundException('Receipt not found');

    const putAways: PutAway[] = [];

    for (const line of dto.lines) {
      const receiptLine = receipt.lines.find((l) => l.id === line.receiptLineId);
      if (!receiptLine) continue;

      const pa = this.putAwayRepo.create({
        receiptLineId: line.receiptLineId,
        storedById: userId,
        location: line.location,
        quantityStored: line.quantityStored,
      });
      await this.putAwayRepo.save(pa);
      putAways.push(pa);

      // Get item_id from the PO line
      const poLine = await this.poLineRepo.findOne({ where: { id: receiptLine.poLineId } });
      if (!poLine) continue;

      // Update inventory level
      await this.updateInventoryOnPutAway(poLine.itemId, line.quantityStored, receiptId, userId);
    }

    await this.auditLog.log({
      userId, action: 'PUT_AWAY', entityType: 'POReceipt', entityId: receiptId,
      after: { lines: dto.lines.length }, ip,
    });
    return putAways;
  }

  private async updateInventoryOnPutAway(
    itemId: string,
    quantity: number,
    referenceId: string,
    userId: string,
  ) {
    let level = await this.inventoryRepo.findOne({ where: { itemId } });
    const qBefore = level ? Number(level.quantityOnHand) : 0;

    if (!level) {
      level = this.inventoryRepo.create({ itemId, quantityOnHand: 0, quantityReserved: 0, quantityOnOrder: 0 });
    }
    level.quantityOnHand = qBefore + quantity;
    await this.inventoryRepo.save(level);

    await this.movementRepo.save(
      this.movementRepo.create({
        itemId,
        type: MovementType.RECEIPT,
        quantity,
        quantityBefore: qBefore,
        quantityAfter: qBefore + quantity,
        referenceType: 'POReceipt',
        referenceId,
        performedById: userId,
      }),
    );
  }

  // ── Reconciliation ──────────────────────────────────────────────────────

  async reconcileOrder(poId: string, userId: string, ip?: string) {
    const po = await this.findPOOrFail(poId);
    const lines = await this.poLineRepo.find({ where: { purchaseOrderId: poId } });

    const discrepancies: Record<string, unknown>[] = [];
    let hasDiscrepancy = false;

    for (const line of lines) {
      const ordered = Number(line.quantity);
      const received = Number(line.receivedQuantity);
      if (ordered !== received) {
        hasDiscrepancy = true;
        discrepancies.push({
          itemId: line.itemId,
          ordered,
          received,
          difference: received - ordered,
        });
      }
    }

    const status = hasDiscrepancy
      ? ReconciliationStatus.DISCREPANCY
      : ReconciliationStatus.MATCHED;

    const reconciliation = this.reconciliationRepo.create({
      purchaseOrderId: poId,
      reconciledById: userId,
      status,
      discrepancies: hasDiscrepancy ? discrepancies : null,
    });
    await this.reconciliationRepo.save(reconciliation);

    await this.auditLog.log({
      userId, action: 'RECONCILE', entityType: 'Reconciliation', entityId: reconciliation.id,
      after: { status, discrepancyCount: discrepancies.length }, ip,
    });
    return reconciliation;
  }

  // ── Query helpers ────────────────────────────────────────────────────────

  async getPO(id: string) {
    const po = await this.poRepo.findOne({ where: { id }, relations: ['lines'] });
    if (!po) throw new NotFoundException('Purchase order not found');
    return po;
  }

  async getPOs() {
    return this.poRepo.find({ relations: ['lines'], order: { createdAt: 'DESC' } });
  }

  async getRFQ(id: string) {
    const rfq = await this.rfqRepo.findOne({ where: { id }, relations: ['lines'] });
    if (!rfq) throw new NotFoundException('RFQ not found');
    return rfq;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async findPROrFail(id: string): Promise<PurchaseRequest> {
    const pr = await this.prRepo.findOne({ where: { id }, relations: ['items'] });
    if (!pr) throw new NotFoundException('Purchase request not found');
    return pr;
  }

  private async findPOOrFail(id: string): Promise<PurchaseOrder> {
    const po = await this.poRepo.findOne({ where: { id } });
    if (!po) throw new NotFoundException('Purchase order not found');
    return po;
  }

  private assertOwnerOrAdmin(ownerId: string, userId: string, userRole?: UserRole) {
    // Admin/supervisor bypass
    if (userRole && [UserRole.ADMIN, UserRole.SUPERVISOR].includes(userRole)) return;
    if (ownerId !== userId) {
      throw new ForbiddenException('You do not have access to this resource');
    }
  }
}
