import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ACTION_KEY } from '../decorators/require-action.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UserRole } from '../../modules/users/user.entity';

/**
 * Maps each action to the roles that are permitted to perform it.
 * This is the single source of truth for action-level RBAC.
 */
const ACTION_ROLE_MAP: Record<string, UserRole[]> = {
  // Procurement
  'procurement:create-request':   [UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.EMPLOYEE],
  'procurement:approve-request':  [UserRole.ADMIN, UserRole.SUPERVISOR],
  'procurement:reject-request':   [UserRole.ADMIN, UserRole.SUPERVISOR],
  'procurement:create-rfq':       [UserRole.ADMIN, UserRole.SUPERVISOR],
  'procurement:add-quote':        [UserRole.ADMIN, UserRole.SUPERVISOR],
  'procurement:create-po':        [UserRole.ADMIN, UserRole.SUPERVISOR],
  'procurement:approve-po':       [UserRole.ADMIN, UserRole.SUPERVISOR],
  'procurement:update-price':     [UserRole.ADMIN],
  'procurement:receive':          [UserRole.ADMIN, UserRole.SUPERVISOR],
  'procurement:inspect':          [UserRole.ADMIN, UserRole.SUPERVISOR],
  'procurement:putaway':          [UserRole.ADMIN, UserRole.SUPERVISOR],
  'procurement:reconcile':        [UserRole.ADMIN, UserRole.SUPERVISOR],
  'procurement:substitute':       [UserRole.ADMIN],

  // Inventory
  'inventory:acknowledge-alert':  [UserRole.ADMIN, UserRole.SUPERVISOR],
  'inventory:run-checks':         [UserRole.ADMIN],
  'inventory:generate-recs':      [UserRole.ADMIN, UserRole.SUPERVISOR],
  'inventory:accept-rec':         [UserRole.ADMIN, UserRole.SUPERVISOR],

  // Lab
  'lab:create-test':              [UserRole.ADMIN, UserRole.SUPERVISOR],
  'lab:update-test':              [UserRole.ADMIN, UserRole.SUPERVISOR],
  'lab:create-sample':            [UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.EMPLOYEE],
  'lab:advance-status':           [UserRole.ADMIN, UserRole.SUPERVISOR],
  'lab:submit-results':           [UserRole.ADMIN, UserRole.SUPERVISOR],
  'lab:create-report':            [UserRole.ADMIN, UserRole.SUPERVISOR],
  'lab:edit-report':              [UserRole.ADMIN, UserRole.SUPERVISOR],
  'lab:archive-report':           [UserRole.ADMIN, UserRole.SUPERVISOR],

  // Projects
  'projects:create':              [UserRole.ADMIN, UserRole.SUPERVISOR],
  'projects:advance-status':      [UserRole.ADMIN, UserRole.SUPERVISOR],
  'projects:create-task':         [UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.EMPLOYEE],
  'projects:advance-task':        [UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.EMPLOYEE],
  'projects:create-milestone':    [UserRole.ADMIN, UserRole.SUPERVISOR],
  'projects:update-milestone':    [UserRole.ADMIN, UserRole.SUPERVISOR],
  'projects:submit-deliverable':  [UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.EMPLOYEE],
  'projects:score-acceptance':    [UserRole.ADMIN, UserRole.SUPERVISOR],

  // Learning
  'learning:create-plan':         [UserRole.ADMIN, UserRole.HR],
  'learning:advance-plan':        [UserRole.ADMIN, UserRole.HR],
  'learning:create-goal':         [UserRole.ADMIN, UserRole.HR],
  'learning:log-session':         [UserRole.ADMIN, UserRole.HR, UserRole.EMPLOYEE],

  // Rules engine
  'rules:create':                 [UserRole.ADMIN],
  'rules:update':                 [UserRole.ADMIN],
  'rules:stage-rollout':          [UserRole.ADMIN],
  'rules:activate':               [UserRole.ADMIN],
  'rules:rollback':               [UserRole.ADMIN],

  // Admin
  'admin:manage-users':           [UserRole.ADMIN],
  'admin:manage-settings':        [UserRole.ADMIN],
};

@Injectable()
export class ActionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredAction = this.reflector.getAllAndOverride<string>(ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredAction) return true; // No action required on this endpoint

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Access denied — no user context');

    const allowedRoles = ACTION_ROLE_MAP[requiredAction];
    if (!allowedRoles) {
      throw new ForbiddenException(`Unknown action: ${requiredAction}`);
    }

    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Action '${requiredAction}' is not permitted for role '${user.role}'`,
      );
    }

    return true;
  }
}
