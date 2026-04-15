import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from '../../src/common/guards/roles.guard';
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

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('allows public routes regardless of user', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(true);
    expect(guard.canActivate(mockContext({}))).toBe(true);
  });

  it('allows when no roles metadata is set', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(undefined);
    expect(guard.canActivate(mockContext({ user: { role: UserRole.EMPLOYEE } }))).toBe(true);
  });

  it('allows when required roles array is empty', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce([]);
    expect(guard.canActivate(mockContext({ user: { role: UserRole.EMPLOYEE } }))).toBe(true);
  });

  it('throws ForbiddenException when user is missing', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce([UserRole.ADMIN]);
    expect(() => guard.canActivate(mockContext({}))).toThrow(ForbiddenException);
  });

  it('allows when user role matches one of the required roles', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce([UserRole.ADMIN, UserRole.SUPERVISOR]);
    expect(
      guard.canActivate(mockContext({ user: { role: UserRole.SUPERVISOR } })),
    ).toBe(true);
  });

  it('denies when user role does not match required roles', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce([UserRole.ADMIN]);
    expect(() =>
      guard.canActivate(mockContext({ user: { role: UserRole.EMPLOYEE } })),
    ).toThrow(ForbiddenException);
  });
});
