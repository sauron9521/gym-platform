import { describe, expect, it } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { AppConfigService } from '#src/common/config/app-config.types';
import { AdminOriginGuard, isAllowedAdminOrigin } from './admin-origin.guard.js';

const admin = 'https://admin.example.test';
const web = 'https://app.example.test';
const ctx = (headers: Record<string, string>): ExecutionContext =>
  ({ switchToHttp: () => ({ getRequest: () => ({ headers }) }) }) as ExecutionContext;

describe('AdminOriginGuard', () => {
  it('allows only the exact configured admin origin, not web, sibling, null or attacker', () => {
    for (const value of [web, 'https://admin.example.test.evil', 'null', 'https://attacker.test']) {
      expect(isAllowedAdminOrigin({ origin: value }, admin)).toBe(false);
    }
    expect(isAllowedAdminOrigin({ origin: admin }, admin)).toBe(true);
    expect(isAllowedAdminOrigin({ origin: admin + '/' }, admin)).toBe(false);
  });

  it('rejects ambiguous repeated headers and contradictory Origin and Referer', () => {
    expect(isAllowedAdminOrigin({ origin: [admin, web] }, admin)).toBe(false);
    expect(isAllowedAdminOrigin({ referer: [admin + '/', web + '/'] }, admin)).toBe(false);
    expect(isAllowedAdminOrigin({ origin: admin, referer: web + '/' }, admin)).toBe(false);
  });

  it('rejects cross-site browser fetches even when Origin is omitted', () => {
    expect(isAllowedAdminOrigin({ 'sec-fetch-site': 'cross-site' }, admin)).toBe(false);
    expect(isAllowedAdminOrigin({ 'sec-fetch-site': 'same-site' }, admin)).toBe(false);
    expect(isAllowedAdminOrigin({ 'sec-fetch-site': 'same-origin' }, admin)).toBe(true);
    expect(isAllowedAdminOrigin({ 'sec-fetch-site': 'none' }, admin)).toBe(true);
  });

  it('rejects foreign or malformed Referer but permits originless SSR requests', () => {
    expect(isAllowedAdminOrigin({ referer: admin + '/users?id=1' }, admin)).toBe(true);
    expect(isAllowedAdminOrigin({ referer: web + '/users' }, admin)).toBe(false);
    expect(isAllowedAdminOrigin({ referer: 'not-a-url' }, admin)).toBe(false);
    expect(isAllowedAdminOrigin({}, admin)).toBe(true);
  });

  it('uses ADMIN_APP_URL when configured; otherwise the historical APP_URL', () => {
    const guard = (adminUrl?: string, appUrl = web) =>
      new AdminOriginGuard({
        get: (key: string) =>
          key === 'ADMIN_APP_URL' ? adminUrl : key === 'APP_URL' ? appUrl : undefined,
      } as unknown as AppConfigService);
    expect(guard(admin).canActivate(ctx({ origin: admin }))).toBe(true);
    expect(() => guard(admin).canActivate(ctx({ origin: web }))).toThrow(ForbiddenException);
    expect(guard().canActivate(ctx({ origin: web }))).toBe(true);
    expect(() => guard().canActivate(ctx({ origin: admin }))).toThrow(ForbiddenException);
    expect(() => guard(undefined, 'not-a-url').canActivate(ctx({}))).toThrow(ForbiddenException);
  });
});
