import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ActionGuard } from '../../src/common/guards/action.guard';
import { UserRole } from '../../src/modules/users/user.entity';

const mockContext = (req: Record<string, unknown>): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({}),
      getNext: () => undefined,
    }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext);

describe('ActionGuard', () => {
  let guard: ActionGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new ActionGuard(reflector);
  });

  it('allows public routes', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(true);
    expect(guard.canActivate(mockContext({}))).toBe(true);
  });

  it('allows when no action metadata is set', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(undefined);
    expect(guard.canActivate(mockContext({ user: { role: UserRole.ADMIN } }))).toBe(true);
  });

  it('throws when no user is present', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce('procurement:create-request');
    expect(() => guard.canActivate(mockContext({}))).toThrow(ForbiddenException);
  });

  it('throws on unknown action', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce('nonexistent:bogus');
    expect(() =>
      guard.canActivate(mockContext({ user: { role: UserRole.ADMIN } })),
    ).toThrow(/Unknown action/);
  });

  it('allows when user role is permitted for action', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce('procurement:update-price');
    expect(
      guard.canActivate(mockContext({ user: { role: UserRole.ADMIN } })),
    ).toBe(true);
  });

  it('denies when user role is not permitted for action', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce('procurement:update-price');
    expect(() =>
      guard.canActivate(mockContext({ user: { role: UserRole.EMPLOYEE } })),
    ).toThrow(/not permitted/);
  });
});
