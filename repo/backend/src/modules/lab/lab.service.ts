import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LabTestDictionary } from './lab-test-dictionary.entity';
import { ReferenceRange } from './reference-range.entity';
import { LabSample, SampleStatus } from './lab-sample.entity';
import { LabResult } from './lab-result.entity';
import { LabReport, ReportStatus } from './lab-report.entity';
import { LabReportVersion } from './lab-report-version.entity';
import { UserRole } from '../users/user.entity';
import { AuditLogService } from '../../common/services/audit-log.service';
import { CreateSampleDto } from './dto/create-sample.dto';
import { SubmitResultsDto } from './dto/submit-results.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { EditReportDto } from './dto/edit-report.dto';
import { CreateTestDto } from './dto/create-test.dto';

// Valid sample status transitions
const STATUS_TRANSITIONS: Record<SampleStatus, SampleStatus[]> = {
  [SampleStatus.SUBMITTED]:   [SampleStatus.IN_PROGRESS],
  [SampleStatus.IN_PROGRESS]: [SampleStatus.REPORTED],
  [SampleStatus.REPORTED]:    [SampleStatus.ARCHIVED],
  [SampleStatus.ARCHIVED]:    [],
};

@Injectable()
export class LabService {
  constructor(
    @InjectRepository(LabTestDictionary) private readonly testRepo: Repository<LabTestDictionary>,
    @InjectRepository(ReferenceRange) private readonly rangeRepo: Repository<ReferenceRange>,
    @InjectRepository(LabSample) private readonly sampleRepo: Repository<LabSample>,
    @InjectRepository(LabResult) private readonly resultRepo: Repository<LabResult>,
    @InjectRepository(LabReport) private readonly reportRepo: Repository<LabReport>,
    @InjectRepository(LabReportVersion) private readonly versionRepo: Repository<LabReportVersion>,
    private readonly auditLog: AuditLogService,
  ) {}

  // ── Identifier Masking ──────────────────────────────────────────────────

  private maskSample(sample: LabSample): LabSample {
    if (sample.patientIdentifier) {
      sample.patientIdentifier = '****' + sample.patientIdentifier.slice(-4);
    }
    return sample;
  }

  private maskSamples(samples: LabSample[]): LabSample[] {
    return samples.map((s) => this.maskSample(s));
  }

  // ── Test Dictionary ─────────────────────────────────────────────────────

  async createTest(dto: CreateTestDto, userId: string): Promise<LabTestDictionary> {
    const test = this.testRepo.create({
      name: dto.name,
      testCode: dto.testCode,
      description: dto.description ?? null,
      sampleType: dto.sampleType ?? null,
      unit: dto.unit ?? null,
    });
    await this.testRepo.save(test);

    if (dto.referenceRanges?.length) {
      const ranges = dto.referenceRanges.map((r) =>
        this.rangeRepo.create({
          testId: test.id,
          population: r.population ?? null,
          minValue: r.minValue ?? null,
          maxValue: r.maxValue ?? null,
          criticalLow: r.criticalLow ?? null,
          criticalHigh: r.criticalHigh ?? null,
        }),
      );
      await this.rangeRepo.save(ranges);
    }

    await this.auditLog.log({
      userId, action: 'CREATE', entityType: 'LabTestDictionary', entityId: test.id,
      after: { name: dto.name, testCode: dto.testCode },
    });
    return this.testRepo.findOne({ where: { id: test.id }, relations: ['referenceRanges'] }) as Promise<LabTestDictionary>;
  }

  async getTests(): Promise<LabTestDictionary[]> {
    return this.testRepo.find({ relations: ['referenceRanges'], order: { name: 'ASC' } });
  }

  async updateTest(id: string, dto: Partial<CreateTestDto>, userId: string): Promise<LabTestDictionary> {
    const test = await this.testRepo.findOne({ where: { id } });
    if (!test) throw new NotFoundException('Test not found');
    await this.testRepo.update(id, {
      name: dto.name ?? test.name,
      description: dto.description ?? test.description,
      unit: dto.unit ?? test.unit,
    });
    await this.auditLog.log({
      userId, action: 'UPDATE', entityType: 'LabTestDictionary', entityId: id, after: dto as Record<string, unknown>,
    });
    return this.testRepo.findOne({ where: { id }, relations: ['referenceRanges'] }) as Promise<LabTestDictionary>;
  }

  // ── Samples ─────────────────────────────────────────────────────────────

  async createSample(dto: CreateSampleDto, userId: string): Promise<LabSample> {
    const sampleNumber = `LAB-${Date.now()}`;
    const sample = this.sampleRepo.create({
      sampleNumber,
      submittedById: userId,
      sampleType: dto.sampleType,
      collectionDate: new Date(dto.collectionDate),
      patientIdentifier: dto.patientIdentifier ?? null,
      notes: dto.notes ?? null,
      status: SampleStatus.SUBMITTED,
    });
    await this.sampleRepo.save(sample);
    await this.auditLog.log({
      userId, action: 'CREATE', entityType: 'LabSample', entityId: sample.id,
      after: { sampleNumber, status: SampleStatus.SUBMITTED },
    });
    return this.maskSample(sample);
  }

  async getSamples(user: { id: string; role: UserRole }): Promise<LabSample[]> {
    // Employees see only their own samples
    const where = user.role === UserRole.EMPLOYEE ? { submittedById: user.id } : {};
    const samples = await this.sampleRepo.find({
      where,
      relations: ['results'],
      order: { createdAt: 'DESC' },
    });
    return this.maskSamples(samples);
  }

  async getSample(id: string, user?: { id: string; role: UserRole }): Promise<LabSample> {
    const sample = await this.sampleRepo.findOne({
      where: { id },
      relations: ['results', 'results.test'],
    });
    if (!sample) throw new NotFoundException('Sample not found');
    // Object-level authorization: employees can only see their own samples
    if (user && user.role === UserRole.EMPLOYEE && sample.submittedById !== user.id) {
      throw new ForbiddenException('You do not have access to this sample');
    }
    return this.maskSample(sample);
  }

  async advanceSampleStatus(id: string, targetStatus: SampleStatus, userId: string): Promise<LabSample> {
    const sample = await this.sampleRepo.findOne({ where: { id } });
    if (!sample) throw new NotFoundException('Sample not found');

    const allowed = STATUS_TRANSITIONS[sample.status];
    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${sample.status} to ${targetStatus}. Allowed: ${allowed.join(', ') || 'none'}`,
      );
    }

    const before = { status: sample.status };
    sample.status = targetStatus;
    await this.sampleRepo.save(sample);
    await this.auditLog.log({
      userId, action: 'STATUS_CHANGE', entityType: 'LabSample', entityId: id,
      before, after: { status: targetStatus },
    });
    return this.maskSample(sample);
  }

  // ── Results ─────────────────────────────────────────────────────────────

  async submitResults(sampleId: string, dto: SubmitResultsDto, userId: string): Promise<LabResult[]> {
    const sample = await this.sampleRepo.findOne({ where: { id: sampleId } });
    if (!sample) throw new NotFoundException('Sample not found');
    if (sample.status === SampleStatus.ARCHIVED) {
      throw new BadRequestException('Cannot add results to an archived sample');
    }

    const saved: LabResult[] = [];
    for (const entry of dto.results) {
      const test = await this.testRepo.findOne({
        where: { id: entry.testId },
        relations: ['referenceRanges'],
      });
      if (!test) throw new NotFoundException(`Test ${entry.testId} not found`);

      const { isAbnormal, isCritical } = this.evaluateAbnormalFlag(
        entry.numericValue ?? null,
        test.referenceRanges ?? [],
      );

      const result = this.resultRepo.create({
        sampleId,
        testId: entry.testId,
        numericValue: entry.numericValue ?? null,
        textValue: entry.textValue ?? null,
        isAbnormal,
        isCritical,
        enteredById: userId,
        notes: entry.notes ?? null,
      });
      saved.push(await this.resultRepo.save(result));
    }

    // Advance to in-progress if still submitted
    if (sample.status === SampleStatus.SUBMITTED) {
      await this.sampleRepo.update(sampleId, { status: SampleStatus.IN_PROGRESS });
    }

    await this.auditLog.log({
      userId, action: 'SUBMIT_RESULTS', entityType: 'LabSample', entityId: sampleId,
      after: { resultCount: saved.length },
    });
    return saved;
  }

  /**
   * Pure function: evaluate whether a numeric result is abnormal or critical.
   * Testable without DB.
   */
  evaluateAbnormalFlag(
    numericValue: number | null,
    ranges: Array<{ minValue: number | null; maxValue: number | null; criticalLow: number | null; criticalHigh: number | null }>,
  ): { isAbnormal: boolean; isCritical: boolean } {
    if (numericValue === null || ranges.length === 0) {
      return { isAbnormal: false, isCritical: false };
    }

    const range = ranges[0]; // Use first (default) range
    const min = range.minValue !== null ? Number(range.minValue) : null;
    const max = range.maxValue !== null ? Number(range.maxValue) : null;
    const critLow = range.criticalLow !== null ? Number(range.criticalLow) : null;
    const critHigh = range.criticalHigh !== null ? Number(range.criticalHigh) : null;

    const isCritical =
      (critLow !== null && numericValue < critLow) ||
      (critHigh !== null && numericValue > critHigh);

    const isAbnormal =
      isCritical ||
      (min !== null && numericValue < min) ||
      (max !== null && numericValue > max);

    return { isAbnormal, isCritical };
  }

  // ── Reports ─────────────────────────────────────────────────────────────

  async createReport(sampleId: string, dto: CreateReportDto, userId: string): Promise<LabReport> {
    const sample = await this.sampleRepo.findOne({ where: { id: sampleId }, relations: ['results'] });
    if (!sample) throw new NotFoundException('Sample not found');
    if (sample.status !== SampleStatus.IN_PROGRESS) {
      throw new BadRequestException('Report can only be created for in-progress samples');
    }

    // Check no report already exists
    const existing = await this.reportRepo.findOne({ where: { sampleId } });
    if (existing) throw new BadRequestException('Report already exists for this sample');

    const reportNumber = `RPT-${Date.now()}`;
    const report = this.reportRepo.create({
      sampleId,
      reportNumber,
      summary: dto.summary ?? null,
      createdById: userId,
      status: ReportStatus.DRAFT,
      currentVersion: 1,
    });
    await this.reportRepo.save(report);

    // Create initial version
    await this.versionRepo.save(
      this.versionRepo.create({
        reportId: report.id,
        versionNumber: 1,
        summary: dto.summary ?? null,
        data: { sampleId, resultCount: sample.results?.length ?? 0 },
        editedById: userId,
        changeReason: 'Initial report creation',
      }),
    );

    // Advance sample to reported
    await this.sampleRepo.update(sampleId, { status: SampleStatus.REPORTED });

    await this.auditLog.log({
      userId, action: 'CREATE', entityType: 'LabReport', entityId: report.id,
      after: { reportNumber, status: ReportStatus.DRAFT },
    });
    return this.reportRepo.findOne({ where: { id: report.id }, relations: ['versions'] }) as Promise<LabReport>;
  }

  async editReport(reportId: string, dto: EditReportDto, userId: string): Promise<LabReport> {
    const report = await this.reportRepo.findOne({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');
    if (report.status === ReportStatus.ARCHIVED) {
      throw new BadRequestException('Cannot edit an archived report');
    }

    const newVersion = report.currentVersion + 1;

    // Save new version (immutable audit trail)
    await this.versionRepo.save(
      this.versionRepo.create({
        reportId,
        versionNumber: newVersion,
        summary: dto.summary ?? report.summary,
        data: { editedSummary: dto.summary },
        editedById: userId,
        changeReason: dto.changeReason ?? null,
      }),
    );

    const before = { summary: report.summary, currentVersion: report.currentVersion };
    report.summary = dto.summary ?? report.summary;
    report.currentVersion = newVersion;
    report.status = ReportStatus.FINAL;
    await this.reportRepo.save(report);

    await this.auditLog.log({
      userId, action: 'EDIT', entityType: 'LabReport', entityId: reportId,
      before, after: { summary: report.summary, version: newVersion },
    });
    return this.reportRepo.findOne({ where: { id: reportId }, relations: ['versions'] }) as Promise<LabReport>;
  }

  async getReportHistory(reportId: string): Promise<LabReportVersion[]> {
    const report = await this.reportRepo.findOne({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');
    return this.versionRepo.find({
      where: { reportId },
      order: { versionNumber: 'DESC' },
    });
  }

  async archiveReport(reportId: string, userId: string): Promise<LabReport> {
    const report = await this.reportRepo.findOne({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');
    if (report.status === ReportStatus.ARCHIVED) {
      throw new BadRequestException('Report is already archived');
    }

    const before = { status: report.status };
    report.status = ReportStatus.ARCHIVED;
    await this.reportRepo.save(report);

    // Also archive the sample
    await this.sampleRepo.update(report.sampleId, { status: SampleStatus.ARCHIVED });

    await this.auditLog.log({
      userId, action: 'ARCHIVE', entityType: 'LabReport', entityId: reportId,
      before, after: { status: ReportStatus.ARCHIVED },
    });
    return report;
  }

  async getReport(reportId: string): Promise<LabReport> {
    const report = await this.reportRepo.findOne({
      where: { id: reportId },
      relations: ['versions'],
    });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }
}
