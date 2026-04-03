import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { Item } from './item.entity';
import { InventoryLevel } from './inventory-level.entity';
import { StockMovement, MovementType } from './stock-movement.entity';
import { Alert, AlertType, AlertSeverity, AlertStatus } from './alert.entity';
import {
  ReplenishmentRecommendation,
  RecommendationStatus,
} from './replenishment-recommendation.entity';
import { RecommendationFeedback, FeedbackType } from './recommendation-feedback.entity';
import { PurchaseRequest, PurchaseRequestStatus } from '../procurement/purchase-request.entity';
import { PurchaseRequestItem } from '../procurement/purchase-request-item.entity';
import { AuditLogService } from '../../common/services/audit-log.service';
import { GenerateRecommendationsDto } from './dto/generate-recommendations.dto';

// Business rule constants
export const NEAR_EXPIRY_DAYS = 45;
export const ABNORMAL_CONSUMPTION_MULTIPLIER = 1.4;
export const REPLENISHMENT_BUFFER_DEFAULT = 14;
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
export const FIFTY_SIX_DAYS_MS = 56 * 24 * 60 * 60 * 1000;

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Item) private readonly itemRepo: Repository<Item>,
    @InjectRepository(InventoryLevel) private readonly levelRepo: Repository<InventoryLevel>,
    @InjectRepository(StockMovement) private readonly movementRepo: Repository<StockMovement>,
    @InjectRepository(Alert) private readonly alertRepo: Repository<Alert>,
    @InjectRepository(ReplenishmentRecommendation)
    private readonly recoRepo: Repository<ReplenishmentRecommendation>,
    @InjectRepository(RecommendationFeedback)
    private readonly feedbackRepo: Repository<RecommendationFeedback>,
    @InjectRepository(PurchaseRequest) private readonly prRepo: Repository<PurchaseRequest>,
    @InjectRepository(PurchaseRequestItem) private readonly priRepo: Repository<PurchaseRequestItem>,
    private readonly auditLog: AuditLogService,
    private readonly dataSource: DataSource,
  ) {}

  // ── Items ─────────────────────────────────────────────────────────────────

  async getItems() {
    const items = await this.itemRepo.find({
      relations: ['category'],
      order: { name: 'ASC' },
    });

    const levels = await this.levelRepo.find();
    const levelMap = new Map(levels.map((l) => [l.itemId, l]));

    const activeAlerts = await this.alertRepo.find({
      where: { status: AlertStatus.ACTIVE },
    });
    const alertMap = new Map<string, Alert[]>();
    for (const a of activeAlerts) {
      const existing = alertMap.get(a.itemId) ?? [];
      existing.push(a);
      alertMap.set(a.itemId, existing);
    }

    return items.map((item) => ({
      ...item,
      stockLevel: levelMap.get(item.id) ?? null,
      alerts: alertMap.get(item.id) ?? [],
    }));
  }

  async getItem(id: string) {
    const item = await this.itemRepo.findOne({ where: { id }, relations: ['category'] });
    if (!item) throw new NotFoundException('Item not found');

    const stockLevel = await this.levelRepo.findOne({ where: { itemId: id } });
    const alerts = await this.alertRepo.find({
      where: { itemId: id, status: AlertStatus.ACTIVE },
    });
    const movements = await this.movementRepo.find({
      where: { itemId: id },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    const recommendations = await this.recoRepo.find({
      where: { itemId: id, status: RecommendationStatus.PENDING },
    });

    return { ...item, stockLevel, alerts, movements, recommendations };
  }

  // ── Alerts ─────────────────────────────────────────────────────────────────

  async getAlerts(status?: AlertStatus) {
    const where = status ? { status } : {};
    return this.alertRepo.find({
      where,
      relations: ['item'],
      order: { createdAt: 'DESC' },
    });
  }

  async acknowledgeAlert(alertId: string, userId: string) {
    const alert = await this.alertRepo.findOne({ where: { id: alertId } });
    if (!alert) throw new NotFoundException('Alert not found');

    alert.status = AlertStatus.ACKNOWLEDGED;
    alert.acknowledgedById = userId;
    alert.acknowledgedAt = new Date();
    await this.alertRepo.save(alert);

    await this.auditLog.log({
      userId,
      action: 'ACKNOWLEDGE_ALERT',
      entityType: 'Alert',
      entityId: alertId,
      after: { status: AlertStatus.ACKNOWLEDGED },
    });
    return alert;
  }

  // ── Alert check functions (pure: testable without DB) ─────────────────────

  /** Returns true if quantity on hand is below safety stock level */
  isSafetyStockBreached(quantityOnHand: number, safetyStockLevel: number): boolean {
    return quantityOnHand < safetyStockLevel;
  }

  /** Returns 'below_min' | 'above_max' | null */
  checkMinMax(
    quantityOnHand: number,
    minLevel: number,
    maxLevel: number,
  ): 'below_min' | 'above_max' | null {
    if (quantityOnHand < minLevel) return 'below_min';
    if (maxLevel > 0 && quantityOnHand > maxLevel) return 'above_max';
    return null;
  }

  /** Returns true if item expires within 45 days */
  isNearExpiration(expiresAt: Date | null, now: Date = new Date()): boolean {
    if (!expiresAt) return false;
    const warningThreshold = new Date(now.getTime() + NEAR_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    return expiresAt <= warningThreshold;
  }

  /** Returns true if 7-day usage > 8-week avg * 1.4 */
  isAbnormalConsumption(sevenDayUsage: number, eightWeekAvgPerDay: number): boolean {
    if (eightWeekAvgPerDay <= 0) return false;
    const eightWeekSevenDayEquivalent = eightWeekAvgPerDay * 7;
    return sevenDayUsage > eightWeekSevenDayEquivalent * ABNORMAL_CONSUMPTION_MULTIPLIER;
  }

  /** Calculate replenishment quantity */
  calculateRecommendedQuantity(
    leadTimeDays: number,
    bufferDays: number,
    avgDailyUsage: number,
  ): number {
    return (leadTimeDays + bufferDays) * avgDailyUsage;
  }

  // ── Scheduled alert runner (called by AlertsService) ─────────────────────

  async runAllAlertChecks(): Promise<void> {
    const items = await this.itemRepo.find();
    const levels = await this.levelRepo.find();
    const levelMap = new Map(levels.map((l) => [l.itemId, l]));

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - SEVEN_DAYS_MS);
    const fiftyDaysAgo = new Date(now.getTime() - FIFTY_SIX_DAYS_MS);

    for (const item of items) {
      const level = levelMap.get(item.id);
      const qty = level ? Number(level.quantityOnHand) : 0;

      // 1. Safety stock alert
      if (this.isSafetyStockBreached(qty, Number(item.safetyStockLevel))) {
        await this.upsertAlert(
          item.id,
          AlertType.SAFETY_STOCK,
          AlertSeverity.HIGH,
          `Stock level (${qty}) is below safety stock threshold (${item.safetyStockLevel})`,
          { quantityOnHand: qty, safetyStockLevel: item.safetyStockLevel },
        );
      } else {
        await this.resolveAlert(item.id, AlertType.SAFETY_STOCK);
      }

      // 2. Min/max alert
      const minMax = this.checkMinMax(qty, Number(item.minLevel), Number(item.maxLevel));
      if (minMax) {
        const msg =
          minMax === 'below_min'
            ? `Stock level (${qty}) is below minimum (${item.minLevel})`
            : `Stock level (${qty}) exceeds maximum (${item.maxLevel})`;
        await this.upsertAlert(
          item.id,
          AlertType.MIN_MAX,
          minMax === 'below_min' ? AlertSeverity.MEDIUM : AlertSeverity.LOW,
          msg,
          { quantityOnHand: qty, minLevel: item.minLevel, maxLevel: item.maxLevel, breach: minMax },
        );
      } else {
        await this.resolveAlert(item.id, AlertType.MIN_MAX);
      }

      // 3. Near-expiration alert
      if (this.isNearExpiration(item.expiresAt, now)) {
        const daysLeft = Math.floor(
          (item.expiresAt!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
        );
        const severity = daysLeft <= 7 ? AlertSeverity.CRITICAL : daysLeft <= 14 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM;
        await this.upsertAlert(
          item.id,
          AlertType.NEAR_EXPIRATION,
          severity,
          `Item expires in ${daysLeft} day(s) (${item.expiresAt!.toISOString().slice(0, 10)})`,
          { expiresAt: item.expiresAt, daysUntilExpiry: daysLeft },
        );
      } else {
        await this.resolveAlert(item.id, AlertType.NEAR_EXPIRATION);
      }

      // 4. Abnormal consumption alert
      const sevenDayIssues = await this.movementRepo.find({
        where: {
          itemId: item.id,
          type: MovementType.ISSUE,
          createdAt: MoreThanOrEqual(sevenDaysAgo),
        },
      });
      const sevenDayUsage = sevenDayIssues.reduce((sum, m) => sum + Number(m.quantity), 0);

      const fiftyDayIssues = await this.movementRepo.find({
        where: {
          itemId: item.id,
          type: MovementType.ISSUE,
          createdAt: MoreThanOrEqual(fiftyDaysAgo),
        },
      });
      const avgDailyUsage56Days =
        fiftyDayIssues.reduce((sum, m) => sum + Number(m.quantity), 0) / 56;

      if (this.isAbnormalConsumption(sevenDayUsage, avgDailyUsage56Days)) {
        await this.upsertAlert(
          item.id,
          AlertType.ABNORMAL_CONSUMPTION,
          AlertSeverity.HIGH,
          `7-day usage (${sevenDayUsage.toFixed(2)}) is >40% above 8-week average (${(avgDailyUsage56Days * 7).toFixed(2)} per 7 days)`,
          { sevenDayUsage, eightWeekAvgPer7Days: avgDailyUsage56Days * 7 },
        );
      } else {
        await this.resolveAlert(item.id, AlertType.ABNORMAL_CONSUMPTION);
      }
    }
  }

  private async upsertAlert(
    itemId: string,
    type: AlertType,
    severity: AlertSeverity,
    message: string,
    metadata: Record<string, unknown>,
  ) {
    const existing = await this.alertRepo.findOne({
      where: { itemId, type, status: AlertStatus.ACTIVE },
    });
    if (existing) {
      await this.alertRepo.update(existing.id, { message, severity, metadata: metadata as any });
    } else {
      await this.alertRepo.save(
        this.alertRepo.create({ itemId, type, severity, status: AlertStatus.ACTIVE, message, metadata }),
      );
    }
  }

  private async resolveAlert(itemId: string, type: AlertType) {
    await this.alertRepo.update(
      { itemId, type, status: AlertStatus.ACTIVE },
      { status: AlertStatus.RESOLVED },
    );
  }

  // ── Replenishment Recommendations ─────────────────────────────────────────

  async generateRecommendations(dto: GenerateRecommendationsDto) {
    const where = dto.itemId ? { id: dto.itemId } : {};
    const items = await this.itemRepo.find({ where });

    const now = new Date();
    const fiftyDaysAgo = new Date(now.getTime() - FIFTY_SIX_DAYS_MS);
    const created: ReplenishmentRecommendation[] = [];

    for (const item of items) {
      const issues = await this.movementRepo.find({
        where: {
          itemId: item.id,
          type: MovementType.ISSUE,
          createdAt: MoreThanOrEqual(fiftyDaysAgo),
        },
      });
      const totalIssued = issues.reduce((sum, m) => sum + Number(m.quantity), 0);
      const avgDailyUsage = totalIssued / 56;

      if (avgDailyUsage <= 0) continue;

      const bufferDays = item.replenishmentBufferDays ?? REPLENISHMENT_BUFFER_DEFAULT;
      const recommendedQuantity = this.calculateRecommendedQuantity(
        item.leadTimeDays,
        bufferDays,
        avgDailyUsage,
      );

      if (recommendedQuantity <= 0) continue;

      const reco = this.recoRepo.create({
        itemId: item.id,
        recommendedQuantity,
        leadTimeDays: item.leadTimeDays,
        bufferDays,
        avgDailyUsage,
        status: RecommendationStatus.PENDING,
      });
      const saved = await this.recoRepo.save(reco);
      created.push(saved);
    }

    return created;
  }

  async getRecommendations() {
    return this.recoRepo.find({
      where: { status: RecommendationStatus.PENDING },
      relations: ['item'],
      order: { createdAt: 'DESC' },
    });
  }

  async acceptRecommendation(id: string, userId: string) {
    const reco = await this.recoRepo.findOne({ where: { id }, relations: ['item'] });
    if (!reco) throw new NotFoundException('Recommendation not found');

    // Record click feedback
    await this.feedbackRepo.save(
      this.feedbackRepo.create({ recommendationId: id, userId, type: FeedbackType.CLICK }),
    );

    // Auto-draft PurchaseRequest
    const requestNumber = `PR-AUTO-${Date.now()}`;
    const pr = this.prRepo.create({
      requestNumber,
      requesterId: userId,
      justification: `Auto-generated from replenishment recommendation for ${reco.item?.name ?? reco.itemId}`,
      status: PurchaseRequestStatus.DRAFT,
    });
    await this.prRepo.save(pr);

    const prItem = this.priRepo.create({
      purchaseRequestId: pr.id,
      itemId: reco.itemId,
      quantity: Number(reco.recommendedQuantity),
      unitOfMeasure: reco.item?.unitOfMeasure ?? 'each',
    });
    await this.priRepo.save(prItem);

    // Update recommendation status
    reco.status = RecommendationStatus.ACCEPTED;
    reco.generatedPrId = pr.id;
    await this.recoRepo.save(reco);

    await this.auditLog.log({
      userId,
      action: 'ACCEPT_RECOMMENDATION',
      entityType: 'ReplenishmentRecommendation',
      entityId: id,
      after: { generatedPrId: pr.id },
    });

    return { recommendation: reco, purchaseRequest: pr };
  }

  async dismissRecommendation(id: string, userId: string) {
    const reco = await this.recoRepo.findOne({ where: { id } });
    if (!reco) throw new NotFoundException('Recommendation not found');

    reco.status = RecommendationStatus.DISMISSED;
    await this.recoRepo.save(reco);
    return reco;
  }

  async recordImpression(id: string, userId: string) {
    const reco = await this.recoRepo.findOne({ where: { id } });
    if (!reco) throw new NotFoundException('Recommendation not found');

    await this.feedbackRepo.save(
      this.feedbackRepo.create({ recommendationId: id, userId, type: FeedbackType.IMPRESSION }),
    );
    return { recorded: true };
  }
}
