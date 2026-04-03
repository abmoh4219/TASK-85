import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BusinessRule, RuleStatus, RuleCategory } from './business-rule.entity';
import { RuleVersion } from './rule-version.entity';
import { RuleRollout, RolloutStatus } from './rule-rollout.entity';
import { AuditLogService } from '../../common/services/audit-log.service';
import { CreateRuleDto, UpdateRuleDto } from './dto/create-rule.dto';

// Business rule: rollback must complete within 5 minutes
const MAX_ROLLBACK_MS = 5 * 60 * 1000;

@Injectable()
export class RulesEngineService {
  constructor(
    @InjectRepository(BusinessRule) private readonly ruleRepo: Repository<BusinessRule>,
    @InjectRepository(RuleVersion) private readonly versionRepo: Repository<RuleVersion>,
    @InjectRepository(RuleRollout) private readonly rolloutRepo: Repository<RuleRollout>,
    private readonly auditLog: AuditLogService,
    private readonly dataSource: DataSource,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async createRule(dto: CreateRuleDto, userId: string): Promise<BusinessRule> {
    const rule = this.ruleRepo.create({
      name: dto.name,
      description: dto.description ?? null,
      category: dto.category ?? RuleCategory.CUSTOM,
      status: RuleStatus.DRAFT,
      currentVersion: 1,
      isAbTest: dto.isAbTest ?? false,
      rolloutPercentage: dto.rolloutPercentage ?? 100,
      createdById: userId,
    });
    await this.ruleRepo.save(rule);

    await this.versionRepo.save(
      this.versionRepo.create({
        ruleId: rule.id,
        versionNumber: 1,
        definition: dto.definition,
        changeSummary: dto.changeSummary ?? 'Initial version',
        createdById: userId,
      }),
    );

    await this.auditLog.log({
      userId, action: 'CREATE', entityType: 'BusinessRule', entityId: rule.id,
      after: { name: dto.name, status: RuleStatus.DRAFT, version: 1 },
    });
    return this.ruleRepo.findOne({ where: { id: rule.id }, relations: ['versions'] }) as Promise<BusinessRule>;
  }

  async getRules(): Promise<BusinessRule[]> {
    return this.ruleRepo.find({ relations: ['versions'], order: { createdAt: 'DESC' } });
  }

  async getRule(id: string): Promise<BusinessRule> {
    const rule = await this.ruleRepo.findOne({ where: { id }, relations: ['versions'] });
    if (!rule) throw new NotFoundException('Rule not found');
    return rule;
  }

  async updateRule(id: string, dto: UpdateRuleDto, userId: string): Promise<BusinessRule> {
    const rule = await this.ruleRepo.findOne({ where: { id } });
    if (!rule) throw new NotFoundException('Rule not found');

    const newVersion = rule.currentVersion + 1;

    if (dto.definition) {
      await this.versionRepo.save(
        this.versionRepo.create({
          ruleId: id,
          versionNumber: newVersion,
          definition: dto.definition,
          changeSummary: dto.changeSummary ?? `Updated to version ${newVersion}`,
          createdById: userId,
        }),
      );
      rule.currentVersion = newVersion;
    }

    if (dto.name) rule.name = dto.name;
    if (dto.description !== undefined) rule.description = dto.description ?? null;
    if (dto.isAbTest !== undefined) rule.isAbTest = dto.isAbTest;
    if (dto.rolloutPercentage !== undefined) rule.rolloutPercentage = dto.rolloutPercentage;
    // Editing reverts to draft if active
    if (rule.status === RuleStatus.ACTIVE) rule.status = RuleStatus.DRAFT;
    await this.ruleRepo.save(rule);

    await this.auditLog.log({
      userId, action: 'UPDATE', entityType: 'BusinessRule', entityId: id,
      after: { version: rule.currentVersion },
    });
    return this.ruleRepo.findOne({ where: { id }, relations: ['versions'] }) as Promise<BusinessRule>;
  }

  // ── Conflict Validation ───────────────────────────────────────────────────

  async validateConflicts(dto: CreateRuleDto): Promise<{
    hasConflicts: boolean;
    conflicts: Array<{ ruleId: string; name: string; reason: string }>;
  }> {
    const conflicts: Array<{ ruleId: string; name: string; reason: string }> = [];

    // Check for name collision in same category
    const sameName = await this.ruleRepo.find({
      where: { name: dto.name, status: RuleStatus.ACTIVE },
    });
    for (const r of sameName) {
      conflicts.push({ ruleId: r.id, name: r.name, reason: 'Active rule with same name exists' });
    }

    // Check for category conflicts if definition has threshold field
    if (dto.definition?.threshold !== undefined && dto.category) {
      const sameCategory = await this.ruleRepo.find({
        where: { category: dto.category, status: RuleStatus.ACTIVE },
      });
      for (const r of sameCategory) {
        const versions = await this.versionRepo.find({
          where: { ruleId: r.id, versionNumber: r.currentVersion },
        });
        const existing = versions[0];
        if (
          existing?.definition?.threshold !== undefined &&
          existing.definition.threshold === dto.definition.threshold
        ) {
          conflicts.push({
            ruleId: r.id,
            name: r.name,
            reason: `Same threshold value (${dto.definition.threshold}) in same category`,
          });
        }
      }
    }

    return { hasConflicts: conflicts.length > 0, conflicts };
  }

  // ── Impact Assessment ─────────────────────────────────────────────────────

  async assessImpact(id: string): Promise<{
    rule: BusinessRule;
    affectedWorkflows: string[];
    estimatedImpact: string;
  }> {
    const rule = await this.ruleRepo.findOne({ where: { id }, relations: ['versions'] });
    if (!rule) throw new NotFoundException('Rule not found');

    const workflowMap: Record<RuleCategory, string[]> = {
      [RuleCategory.PROCUREMENT_THRESHOLD]: ['Purchase Request Approval', 'PO Issuance', 'RFQ Generation'],
      [RuleCategory.CANCELLATION]:          ['Purchase Order Cancellation', 'Sample Cancellation'],
      [RuleCategory.PRICING]:               ['PO Line Price Lock', 'Quote Comparison'],
      [RuleCategory.PARSING]:               ['Data Import', 'Report Generation'],
      [RuleCategory.INVENTORY]:             ['Safety Stock Alerts', 'Replenishment Recommendations'],
      [RuleCategory.CUSTOM]:                ['Custom Workflow'],
    };

    const affectedWorkflows = workflowMap[rule.category] ?? ['Unknown'];
    const estimatedImpact =
      rule.rolloutPercentage < 100
        ? `A/B test: ${rule.rolloutPercentage}% of traffic affected`
        : 'Full rollout: all users affected';

    return { rule, affectedWorkflows, estimatedImpact };
  }

  // ── Staged Rollout ────────────────────────────────────────────────────────

  async stageRollout(
    id: string, rolloutPercentage: number, userId: string,
  ): Promise<BusinessRule> {
    const rule = await this.ruleRepo.findOne({ where: { id } });
    if (!rule) throw new NotFoundException('Rule not found');

    rule.status = RuleStatus.STAGED;
    rule.rolloutPercentage = rolloutPercentage;
    await this.ruleRepo.save(rule);

    await this.auditLog.log({
      userId, action: 'STAGE_ROLLOUT', entityType: 'BusinessRule', entityId: id,
      after: { status: RuleStatus.STAGED, rolloutPercentage },
    });
    return rule;
  }

  // ── Activate (hot update — no restart) ───────────────────────────────────

  async activateRule(id: string, userId: string): Promise<{ rule: BusinessRule; rollout: RuleRollout }> {
    const rule = await this.ruleRepo.findOne({ where: { id } });
    if (!rule) throw new NotFoundException('Rule not found');
    if (rule.status === RuleStatus.ACTIVE) {
      throw new BadRequestException('Rule is already active');
    }

    const previousVersion = rule.currentVersion - 1;
    const now = new Date();

    // Mark current version activated
    await this.versionRepo.update(
      { ruleId: id, versionNumber: rule.currentVersion },
      { activatedAt: now },
    );

    rule.status = RuleStatus.ACTIVE;
    await this.ruleRepo.save(rule);

    const rollout = this.rolloutRepo.create({
      ruleId: id,
      fromVersion: Math.max(previousVersion, 1),
      toVersion: rule.currentVersion,
      status: RolloutStatus.COMPLETED,
      initiatedById: userId,
      startedAt: now,
      completedAt: now,
      durationMs: 0,
    });
    await this.rolloutRepo.save(rollout);

    await this.auditLog.log({
      userId, action: 'ACTIVATE', entityType: 'BusinessRule', entityId: id,
      after: { status: RuleStatus.ACTIVE, version: rule.currentVersion },
    });
    return { rule, rollout };
  }

  // ── Rollback (must complete in <5 minutes) ────────────────────────────────

  async rollbackRule(id: string, userId: string): Promise<{
    rule: BusinessRule;
    restoredVersion: number;
    durationMs: number;
    completedWithinLimit: boolean;
  }> {
    const startedAt = new Date();

    const rule = await this.ruleRepo.findOne({ where: { id }, relations: ['versions'] });
    if (!rule) throw new NotFoundException('Rule not found');
    if (rule.currentVersion <= 1) {
      throw new BadRequestException('Cannot rollback — no previous version exists');
    }

    const targetVersion = rule.currentVersion - 1;

    // Run rollback in a transaction for atomicity
    await this.dataSource.transaction(async (manager) => {
      // Mark current version as rolled back
      await manager.update(RuleVersion, { ruleId: id, versionNumber: rule.currentVersion }, {
        rolledBackAt: new Date(),
      });

      // Restore previous version's definition as the "active" definition
      const prevVersion = rule.versions.find((v) => v.versionNumber === targetVersion);
      if (!prevVersion) {
        throw new BadRequestException(`Version ${targetVersion} not found`);
      }

      // Update rule to point back to previous version
      await manager.update(BusinessRule, { id }, {
        currentVersion: targetVersion,
        status: RuleStatus.ACTIVE,
      });
    });

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();
    const completedWithinLimit = durationMs < MAX_ROLLBACK_MS;

    // Record rollout record for the rollback
    await this.rolloutRepo.save(
      this.rolloutRepo.create({
        ruleId: id,
        fromVersion: rule.currentVersion,
        toVersion: targetVersion,
        status: RolloutStatus.ROLLED_BACK,
        initiatedById: userId,
        startedAt,
        completedAt,
        rollbackAt: completedAt,
        durationMs,
      }),
    );

    await this.auditLog.log({
      userId, action: 'ROLLBACK', entityType: 'BusinessRule', entityId: id,
      before: { version: rule.currentVersion },
      after: { version: targetVersion, durationMs, completedWithinLimit },
    });

    // Reload to get updated state
    const updatedRule = await this.ruleRepo.findOne({ where: { id }, relations: ['versions'] });
    return {
      rule: updatedRule!,
      restoredVersion: targetVersion,
      durationMs,
      completedWithinLimit,
    };
  }

  // ── Pure helper for unit tests ────────────────────────────────────────────

  isRollbackWithinTimeLimit(durationMs: number): boolean {
    return durationMs < MAX_ROLLBACK_MS;
  }

  detectConflict(
    newRule: { name: string; category: string; definition: Record<string, unknown> },
    existingRules: Array<{ name: string; category: string; definition: Record<string, unknown> }>,
  ): { hasConflict: boolean; reason: string | null } {
    for (const existing of existingRules) {
      if (existing.name === newRule.name) {
        return { hasConflict: true, reason: 'Duplicate name in same scope' };
      }
      if (
        existing.category === newRule.category &&
        existing.definition.threshold !== undefined &&
        newRule.definition.threshold !== undefined &&
        existing.definition.threshold === newRule.definition.threshold
      ) {
        return { hasConflict: true, reason: 'Duplicate threshold in same category' };
      }
    }
    return { hasConflict: false, reason: null };
  }
}
