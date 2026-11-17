import { createHash } from 'node:crypto';

import { Logger } from '@nestjs/common';
import { afterEach, expect, test, vi } from 'vitest';

import { AdminAuditLogger } from './admin-audit.logger.js';

afterEach(() => vi.restoreAllMocks());

test('emits a versioned structured event without exposing account or target IDs', () => {
  const spy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  new AdminAuditLogger().record({
    permission: 'admin.roles.assign',
    actorId: 'actor-uuid-sensitive',
    targetId: 'target-uuid-sensitive',
    requestId: 'req-123',
    outcome: 'denied',
  });

  const event = spy.mock.calls[0]?.[0] as Record<string, unknown>;
  expect(event).toMatchObject({
    event: 'ADMIN_AUDIT_EVENT',
    schemaVersion: 1,
    permission: 'admin.roles.assign',
    outcome: 'denied',
    requestId: 'req-123',
  });
  expect(event.actorHash).toBe(
    createHash('sha256').update('actor-uuid-sensitive').digest('hex'),
  );
  expect(JSON.stringify(event)).not.toContain('actor-uuid-sensitive');
  expect(JSON.stringify(event)).not.toContain('target-uuid-sensitive');
});

test('rejects unknown actions and never records untrusted request IDs', () => {
  const spy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  const audit = new AdminAuditLogger();
  expect(() =>
    audit.record({
      permission: 'unknown' as 'admin.roles.assign',
      actorId: 'actor',
      outcome: 'allowed',
    }),
  ).toThrow();
  expect(spy).not.toHaveBeenCalled();

  audit.record({
    permission: 'admin.console.read',
    actorId: 'actor',
    requestId: 'Bearer secret leaked',
    outcome: 'allowed',
  });
  expect(spy.mock.calls[0]?.[0]).not.toHaveProperty('requestId');
});
