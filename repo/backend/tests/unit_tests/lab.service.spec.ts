import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { LabService } from '../../src/modules/lab/lab.service';
import { LabTestDictionary } from '../../src/modules/lab/lab-test-dictionary.entity';
import { ReferenceRange } from '../../src/modules/lab/reference-range.entity';
import { LabSample, SampleStatus } from '../../src/modules/lab/lab-sample.entity';
import { LabResult } from '../../src/modules/lab/lab-result.entity';
import { LabReport, ReportStatus } from '../../src/modules/lab/lab-report.entity';
import { LabReportVersion } from '../../src/modules/lab/lab-report-version.entity';
import { UserRole } from '../../src/modules/users/user.entity';
import { AuditLogService } from '../../src/common/services/audit-log.service';

const mockRepo = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockImplementation((d) => ({ ...d })),
  save: jest.fn().mockImplementation((d) => Promise.resolve(Array.isArray(d) ? d : { id: 'id-1', ...d })),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
});

describe('LabService', () => {
  let service: LabService;
  let testRepo: ReturnType<typeof mockRepo>;
  let rangeRepo: ReturnType<typeof mockRepo>;
  let sampleRepo: ReturnType<typeof mockRepo>;
  let resultRepo: ReturnType<typeof mockRepo>;
  let reportRepo: ReturnType<typeof mockRepo>;
  let versionRepo: ReturnType<typeof mockRepo>;
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    testRepo = mockRepo();
    rangeRepo = mockRepo();
    sampleRepo = mockRepo();
    resultRepo = mockRepo();
    reportRepo = mockRepo();
    versionRepo = mockRepo();
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LabService,
        { provide: getRepositoryToken(LabTestDictionary), useValue: testRepo },
        { provide: getRepositoryToken(ReferenceRange), useValue: rangeRepo },
        { provide: getRepositoryToken(LabSample), useValue: sampleRepo },
        { provide: getRepositoryToken(LabResult), useValue: resultRepo },
        { provide: getRepositoryToken(LabReport), useValue: reportRepo },
        { provide: getRepositoryToken(LabReportVersion), useValue: versionRepo },
        { provide: AuditLogService, useValue: audit },
      ],
    }).compile();

    service = module.get(LabService);
  });

  describe('evaluateAbnormalFlag', () => {
    it('returns false when no numeric or ranges', () => {
      expect(service.evaluateAbnormalFlag(null, [])).toEqual({ isAbnormal: false, isCritical: false });
      expect(service.evaluateAbnormalFlag(10, [])).toEqual({ isAbnormal: false, isCritical: false });
    });

    it('flags critical low', () => {
      const res = service.evaluateAbnormalFlag(1, [{ minValue: 5, maxValue: 20, criticalLow: 2, criticalHigh: 30 }]);
      expect(res.isCritical).toBe(true);
      expect(res.isAbnormal).toBe(true);
    });

    it('flags critical high', () => {
      const res = service.evaluateAbnormalFlag(100, [{ minValue: 5, maxValue: 20, criticalLow: 2, criticalHigh: 30 }]);
      expect(res.isCritical).toBe(true);
    });

    it('flags abnormal below min (non-critical)', () => {
      const res = service.evaluateAbnormalFlag(4, [{ minValue: 5, maxValue: 20, criticalLow: null, criticalHigh: null }]);
      expect(res.isAbnormal).toBe(true);
      expect(res.isCritical).toBe(false);
    });

    it('flags abnormal above max', () => {
      const res = service.evaluateAbnormalFlag(25, [{ minValue: 5, maxValue: 20, criticalLow: null, criticalHigh: null }]);
      expect(res.isAbnormal).toBe(true);
    });

    it('normal value', () => {
      const res = service.evaluateAbnormalFlag(10, [{ minValue: 5, maxValue: 20, criticalLow: 2, criticalHigh: 30 }]);
      expect(res.isAbnormal).toBe(false);
    });
  });

  describe('tests', () => {
    it('createTest with reference ranges', async () => {
      testRepo.save.mockResolvedValueOnce({ id: 't1' });
      testRepo.findOne.mockResolvedValueOnce({ id: 't1' });
      await service.createTest({
        name: 'Glucose', testCode: 'GLU',
        referenceRanges: [{ minValue: 70, maxValue: 110, criticalLow: 40, criticalHigh: 300 }],
      } as any, 'u1');
      expect(rangeRepo.save).toHaveBeenCalled();
    });

    it('createTest without reference ranges', async () => {
      testRepo.save.mockResolvedValueOnce({ id: 't1' });
      testRepo.findOne.mockResolvedValueOnce({ id: 't1' });
      await service.createTest({ name: 'Glucose', testCode: 'GLU' } as any, 'u1');
      expect(rangeRepo.save).not.toHaveBeenCalled();
    });

    it('getTests', async () => {
      testRepo.find.mockResolvedValue([{ id: 't1' }]);
      expect(await service.getTests()).toHaveLength(1);
    });

    it('updateTest happy path', async () => {
      testRepo.findOne
        .mockResolvedValueOnce({ id: 't1', name: 'old', description: 'd', unit: 'u' })
        .mockResolvedValueOnce({ id: 't1' });
      await service.updateTest('t1', { name: 'new' }, 'u1');
      expect(testRepo.update).toHaveBeenCalled();
    });

    it('updateTest throws when missing', async () => {
      testRepo.findOne.mockResolvedValue(null);
      await expect(service.updateTest('x', {}, 'u1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('samples', () => {
    it('createSample masks identifier', async () => {
      const res = await service.createSample({
        sampleType: 'blood', collectionDate: new Date().toISOString(), patientIdentifier: '1234567890',
      } as any, 'u1');
      expect(res.patientIdentifier).toBe('****7890');
    });

    it('getSamples filters by employee', async () => {
      sampleRepo.find.mockResolvedValue([{ id: 's1', patientIdentifier: '123456' }]);
      const res = await service.getSamples({ id: 'u1', role: UserRole.EMPLOYEE });
      expect(res[0].patientIdentifier).toBe('****3456');
    });

    it('getSamples returns all for admin', async () => {
      sampleRepo.find.mockResolvedValue([]);
      await service.getSamples({ id: 'u1', role: UserRole.ADMIN });
      expect(sampleRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });

    it('getSample throws when missing', async () => {
      sampleRepo.findOne.mockResolvedValue(null);
      await expect(service.getSample('x')).rejects.toThrow(NotFoundException);
    });

    it('getSample forbids employee accessing others', async () => {
      sampleRepo.findOne.mockResolvedValue({ id: 's1', submittedById: 'other', patientIdentifier: null });
      await expect(
        service.getSample('s1', { id: 'u1', role: UserRole.EMPLOYEE }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('getSample allows employee to own sample', async () => {
      sampleRepo.findOne.mockResolvedValue({ id: 's1', submittedById: 'u1', patientIdentifier: null });
      const res = await service.getSample('s1', { id: 'u1', role: UserRole.EMPLOYEE });
      expect(res).toBeDefined();
    });

    it('advanceSampleStatus valid transition', async () => {
      sampleRepo.findOne.mockResolvedValue({ id: 's1', status: SampleStatus.SUBMITTED, patientIdentifier: null });
      const res = await service.advanceSampleStatus('s1', SampleStatus.IN_PROGRESS, 'u1');
      expect(res.status).toBe(SampleStatus.IN_PROGRESS);
    });

    it('advanceSampleStatus invalid transition', async () => {
      sampleRepo.findOne.mockResolvedValue({ id: 's1', status: SampleStatus.ARCHIVED });
      await expect(
        service.advanceSampleStatus('s1', SampleStatus.SUBMITTED, 'u1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('advanceSampleStatus throws when missing', async () => {
      sampleRepo.findOne.mockResolvedValue(null);
      await expect(service.advanceSampleStatus('x', SampleStatus.IN_PROGRESS, 'u1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('submitResults', () => {
    it('throws when sample missing', async () => {
      sampleRepo.findOne.mockResolvedValue(null);
      await expect(service.submitResults('x', { results: [] } as any, 'u1')).rejects.toThrow(NotFoundException);
    });

    it('throws when archived', async () => {
      sampleRepo.findOne.mockResolvedValue({ id: 's1', status: SampleStatus.ARCHIVED });
      await expect(service.submitResults('s1', { results: [] } as any, 'u1')).rejects.toThrow(BadRequestException);
    });

    it('throws when test not found', async () => {
      sampleRepo.findOne.mockResolvedValue({ id: 's1', status: SampleStatus.SUBMITTED });
      testRepo.findOne.mockResolvedValue(null);
      await expect(
        service.submitResults('s1', { results: [{ testId: 't1', numericValue: 10 }] } as any, 'u1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('saves results and advances to in-progress', async () => {
      sampleRepo.findOne.mockResolvedValue({ id: 's1', status: SampleStatus.SUBMITTED });
      testRepo.findOne.mockResolvedValue({ id: 't1', referenceRanges: [] });
      const res = await service.submitResults(
        's1',
        { results: [{ testId: 't1', numericValue: 10, notes: 'n' }] } as any,
        'u1',
      );
      expect(res).toHaveLength(1);
      expect(sampleRepo.update).toHaveBeenCalled();
    });

    it('skips advance when already in-progress', async () => {
      sampleRepo.findOne.mockResolvedValue({ id: 's1', status: SampleStatus.IN_PROGRESS });
      testRepo.findOne.mockResolvedValue({ id: 't1', referenceRanges: [] });
      await service.submitResults(
        's1',
        { results: [{ testId: 't1', numericValue: 10 }] } as any,
        'u1',
      );
      expect(sampleRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('reports', () => {
    it('createReport happy path', async () => {
      sampleRepo.findOne.mockResolvedValue({ id: 's1', status: SampleStatus.IN_PROGRESS, results: [] });
      reportRepo.findOne
        .mockResolvedValueOnce(null) // existing check
        .mockResolvedValueOnce({ id: 'r1' }); // final return
      await service.createReport('s1', { summary: 'x' } as any, 'u1');
      expect(reportRepo.save).toHaveBeenCalled();
      expect(versionRepo.save).toHaveBeenCalled();
    });

    it('createReport throws when sample missing', async () => {
      sampleRepo.findOne.mockResolvedValue(null);
      await expect(service.createReport('x', {} as any, 'u1')).rejects.toThrow(NotFoundException);
    });

    it('createReport throws when sample not in-progress', async () => {
      sampleRepo.findOne.mockResolvedValue({ id: 's1', status: SampleStatus.SUBMITTED });
      await expect(service.createReport('s1', {} as any, 'u1')).rejects.toThrow(BadRequestException);
    });

    it('createReport throws on duplicate', async () => {
      sampleRepo.findOne.mockResolvedValue({ id: 's1', status: SampleStatus.IN_PROGRESS, results: [] });
      reportRepo.findOne.mockResolvedValue({ id: 'existing' });
      await expect(service.createReport('s1', {} as any, 'u1')).rejects.toThrow(BadRequestException);
    });

    it('editReport advances version', async () => {
      reportRepo.findOne
        .mockResolvedValueOnce({ id: 'r1', summary: 'old', currentVersion: 1, status: ReportStatus.DRAFT })
        .mockResolvedValueOnce({ id: 'r1', currentVersion: 2 });
      await service.editReport('r1', { summary: 'new', changeReason: 'fix' } as any, 'u1');
      expect(versionRepo.save).toHaveBeenCalled();
    });

    it('editReport throws on archived', async () => {
      reportRepo.findOne.mockResolvedValue({ id: 'r1', status: ReportStatus.ARCHIVED });
      await expect(service.editReport('r1', {} as any, 'u1')).rejects.toThrow(BadRequestException);
    });

    it('editReport throws when missing', async () => {
      reportRepo.findOne.mockResolvedValue(null);
      await expect(service.editReport('x', {} as any, 'u1')).rejects.toThrow(NotFoundException);
    });

    it('getReportHistory employee forbidden', async () => {
      reportRepo.findOne.mockResolvedValue({ id: 'r1', sampleId: 's1' });
      sampleRepo.findOne.mockResolvedValue({ id: 's1', submittedById: 'other' });
      await expect(
        service.getReportHistory('r1', { id: 'u1', role: UserRole.EMPLOYEE }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('getReportHistory returns versions', async () => {
      reportRepo.findOne.mockResolvedValue({ id: 'r1', sampleId: 's1' });
      versionRepo.find.mockResolvedValue([{ versionNumber: 1 }]);
      const res = await service.getReportHistory('r1');
      expect(res).toHaveLength(1);
    });

    it('getReportHistory throws when missing', async () => {
      reportRepo.findOne.mockResolvedValue(null);
      await expect(service.getReportHistory('x')).rejects.toThrow(NotFoundException);
    });

    it('archiveReport archives', async () => {
      reportRepo.findOne.mockResolvedValue({ id: 'r1', sampleId: 's1', status: ReportStatus.FINAL });
      const res = await service.archiveReport('r1', 'u1');
      expect(res.status).toBe(ReportStatus.ARCHIVED);
    });

    it('archiveReport throws when already archived', async () => {
      reportRepo.findOne.mockResolvedValue({ id: 'r1', status: ReportStatus.ARCHIVED });
      await expect(service.archiveReport('r1', 'u1')).rejects.toThrow(BadRequestException);
    });

    it('archiveReport throws when missing', async () => {
      reportRepo.findOne.mockResolvedValue(null);
      await expect(service.archiveReport('x', 'u1')).rejects.toThrow(NotFoundException);
    });

    it('getReport employee forbidden', async () => {
      reportRepo.findOne.mockResolvedValue({ id: 'r1', sampleId: 's1' });
      sampleRepo.findOne.mockResolvedValue({ id: 's1', submittedById: 'other' });
      await expect(service.getReport('r1', { id: 'u1', role: UserRole.EMPLOYEE })).rejects.toThrow(ForbiddenException);
    });

    it('getReport returns for admin', async () => {
      reportRepo.findOne.mockResolvedValue({ id: 'r1', sampleId: 's1' });
      const res = await service.getReport('r1');
      expect(res).toBeDefined();
    });

    it('getReport throws when missing', async () => {
      reportRepo.findOne.mockResolvedValue(null);
      await expect(service.getReport('x')).rejects.toThrow(NotFoundException);
    });
  });
});
