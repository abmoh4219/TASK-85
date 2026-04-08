import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminPolicy } from './admin-policy.entity';

/** Default policies seeded on first access */
const DEFAULT_POLICIES: Record<string, { value: Record<string, unknown>; description: string }> = {
  'rate-limiting': {
    value: {
      enabled: true,
      limit: 10,
      ttlSeconds: 60,
      sensitiveEndpoints: ['login', 'procurement', 'rules-engine'],
    },
    description: 'Rate limiting configuration for sensitive endpoints',
  },
  'jwt-config': {
    value: {
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '8h',
      serverSideStorage: true,
      tokenRotation: true,
    },
    description: 'JWT and token configuration (read-only display)',
  },
  'export-permissions': {
    value: {
      admin: { scope: 'all', fields: '*' },
      supervisor: { scope: 'procurement,inventory,projects', fields: 'standard' },
      hr: { scope: 'learning,reports', fields: 'standard' },
      employee: { scope: 'own-records', fields: 'limited' },
    },
    description: 'Export permissions per role',
  },
  'data-security': {
    value: {
      encryptionAlgorithm: 'AES-256-CBC',
      passwordHashing: 'bcrypt-12',
      identifierMasking: true,
      softDeletesOnly: true,
    },
    description: 'Data security configuration',
  },
};

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(AdminPolicy) private readonly repo: Repository<AdminPolicy>,
  ) {}

  async getAllPolicies(): Promise<AdminPolicy[]> {
    await this.ensureDefaults();
    return this.repo.find({ order: { key: 'ASC' } });
  }

  async getPolicy(key: string): Promise<AdminPolicy> {
    await this.ensureDefaults();
    const policy = await this.repo.findOne({ where: { key } });
    if (!policy) throw new NotFoundException(`Policy '${key}' not found`);
    return policy;
  }

  async updatePolicy(key: string, value: Record<string, unknown>, userId: string): Promise<AdminPolicy> {
    const policy = await this.repo.findOne({ where: { key } });
    if (!policy) throw new NotFoundException(`Policy '${key}' not found`);
    policy.value = value;
    policy.updatedById = userId;
    return this.repo.save(policy);
  }

  /**
   * Check if a role has export permission for a given scope.
   * Used by export endpoints to enforce policy.
   */
  async canExport(role: string, scope: string): Promise<boolean> {
    await this.ensureDefaults();
    const policy = await this.repo.findOne({ where: { key: 'export-permissions' } });
    if (!policy) return false;
    const rolePerm = (policy.value as Record<string, { scope: string }>)[role];
    if (!rolePerm) return false;
    if (rolePerm.scope === 'all') return true;
    return rolePerm.scope.split(',').includes(scope);
  }

  private async ensureDefaults(): Promise<void> {
    const count = await this.repo.count();
    if (count > 0) return;
    for (const [key, config] of Object.entries(DEFAULT_POLICIES)) {
      await this.repo.save(
        this.repo.create({ key, value: config.value, description: config.description }),
      );
    }
  }
}
