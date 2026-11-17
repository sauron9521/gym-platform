import { createHash } from 'node:crypto';

import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RequestContextMiddleware } from '../request-context/request-context.middleware.js';
import { AdminAuditLogger } from './admin-audit.logger.js';
import { AdminAuditModule } from './admin-audit.module.js';

const actorId = 'f09d7567-626e-45d8-99f1-829ce4204fbd';
const targetId = 'd09c7567-626e-45d8-99f1-829ce4204fbd';

afterEach(() => vi.restoreAllMocks());

describe('admin audit logging foundation', () => {
  it('provides an injectable, exported feature module', () => {
    const metadata = Reflect.getMetadata('exports', AdminAuditModule);
    expect(metadata).toContain(AdminAuditLogger);
  });

  it('records only validated, versioned, pseudonymized structured fields', () => {
    const spy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    new AdminAuditLogger().record({
      actorId,
      targetId,
      permission: 'admin.roles.assign',
      outcome: 'denied',
    });

    const record = spy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(record).toMatchObject({
      event: 'ADMIN_AUDIT_EVENT',
      schemaVersion: 1,
      permission: 'admin.roles.assign',
      outcome: 'denied',
    });
    expect(record.actorHash).toBe(
      createHash('sha256').update('gym.admin.audit.v1:actor:' + actorId).digest('hex'),
    );
    expect(record.targetHash).toBe(
      createHash('sha256').update('gym.admin.audit.v1:target:' + targetId).digest('hex'),
    );
    expect(record).not.toHaveProperty('requestId');
    expect(JSON.stringify(record)).not.toContain(actorId);
    expect(JSON.stringify(record)).not.toContain(targetId);
    expect(record.actorHash).not.toEqual(record.targetHash);
  });

  it('rejects bad IDs, unknown permissions, outcomes and unexpected untrusted fields', () => {
    const spy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const logger = new AdminAuditLogger();
    const valid = { actorId, permission: 'admin.audit.read', outcome: 'allowed' } as const;
    const cases: unknown[] = [
      { ...valid, permission: 'admin.unknown' },
      { ...valid, outcome: 'unexpected' },
      { ...valid, actorId: 'not-a-uuid' },
      { ...valid, actorId: '' },
      { ...valid, targetId: 'target-email@example.test' },
      { ...valid, requestId: 'Bearer secret' },
      { ...valid, email: 'private@example.test' },
      null,
    ];
    for (const invalid of cases) {
      expect(() => logger.record(invalid as never)).toThrow();
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not accept a browser-provided correlation header', () => {
    const spy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const request = { headers: { 'x-request-id': 'Bearer secret' } } as never;
    new AdminAuditLogger().record(
      { actorId, permission: 'admin.console.read', outcome: 'allowed' },
      request,
    );
    expect(spy.mock.calls[0]?.[0]).not.toHaveProperty('requestId');
  });

  it('correlates only the server-generated request context ID', () => {
    const spy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const request = { path: '/admin', method: 'POST', headers: { 'x-request-id': 'spoofed' } };
    const response = { setHeader: vi.fn(), once: vi.fn() };
    const metrics = { requestStarted: vi.fn() };
    const middleware = new RequestContextMiddleware(metrics as never);

    const next = vi.fn();
    middleware.use(request as never, response as never, next);
    expect(next).toHaveBeenCalledOnce();
    new AdminAuditLogger().record(
      { actorId, permission: 'admin.roles.assign', outcome: 'failed' },
      request as never,
    );

    const event = spy.mock.calls.find((call) => {
      const item = call[0] as Record<string, unknown>;
      return item.event === 'ADMIN_AUDIT_EVENT';
    })?.[0] as Record<string, unknown> | undefined;
    expect(event?.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(event?.requestId).not.toBe('spoofed');
    expect(event?.requestId).not.toBe('Bearer secret');
  });
});
