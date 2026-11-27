import { describe, expect, it, vi } from 'vitest';
import {
  REMINDER_PREFIX,
  cancelManagedNativeReminders,
  reconcileNativeReminders,
  type NativeReminderPort,
  type PendingReminder,
} from '@/features/notifications/lib/native-reminder-reconciliation';

const ownerId = '11111111-1111-4111-8111-111111111111';
const workoutId = (n: number) => '22222222-2222-4222-8222-' + String(n).padStart(12, '0');
const base = Date.parse('2026-11-27T12:00:00Z');
const due = (n: number) => new Date(base + n * 60000).toISOString();
const row = (n: number, minutes = 60) => ({ workoutId: workoutId(n), dueAt: due(minutes) });
const input = {
  ownerId,
  locale: 'en' as const,
  plan: { kind: 'ready' as const, reminders: [row(1)] },
  isCurrent: () => true,
};
const unrelated = { identifier: 'unrelated', content: { title: 'Other' }, trigger: null };
function fixture(platform: NativeReminderPort['platform'] = 'android') {
  let pending: PendingReminder[] = [unrelated];
  let now = base;
  let presented: string[] = [];
  // Stable opaque fake digest; the native port test verifies SHA-256 delegation.
  const hashes = new Map<string, string>();
  const port = {
    platform,
    now: () => now,
    digest: vi.fn(async (value: string) => {
      if (!hashes.has(value)) hashes.set(value, (hashes.size + 1).toString(16).padStart(64, '0'));
      return hashes.get(value)!;
    }),
    list: vi.fn(async () => pending.map((row) => structuredClone(row))),
    cancel: vi.fn(async (id: string) => {
      pending = pending.filter((row) => row.identifier !== id);
    }),
    listPresented: vi.fn(async () => [...presented]),
    dismiss: vi.fn(async (id: string) => {
      presented = presented.filter((value) => value !== id);
    }),
    canSchedule: vi.fn(async () => true),
    schedule: vi.fn(async (item: Parameters<NativeReminderPort['schedule']>[0]) => {
      pending.push({
        identifier: item.identifier,
        content: { title: item.title, body: item.body, data: {} },
        trigger:
          platform === 'android'
            ? {
                type: 'date',
                value: item.dueAt,
                channelId: 'workout-reminders',
                delivery: 'bestEffort',
                repeats: false,
              }
            : { type: 'timeInterval', seconds: (item.dueAt - now) / 1000, repeats: false },
      });
      return item.identifier;
    }),
  };
  return {
    port,
    get rows() {
      return pending;
    },
    set rows(value) {
      pending = value;
    },
    get presented() {
      return presented;
    },
    set presented(value: string[]) {
      presented = value;
    },
    setNow(value: number) {
      now = value;
    },
  };
}
describe('native reminder reconciliation (not activated)', () => {
  it.each(['android', 'ios'] as const)(
    'idempotent %s scheduling, generic localized payload, no account/workout IDs in native requests',
    async (platform) => {
      const f = fixture(platform);
      expect(await reconcileNativeReminders(f.port, input)).toMatchObject({
        kind: 'ready',
        pending: 1,
      });
      const scheduled = f.port.schedule.mock.calls[0]![0];
      expect(scheduled.identifier).toMatch(/^ovranto\.workout-reminder\.v1\.[a-f0-9]{64}$/);
      expect(JSON.stringify(scheduled)).not.toContain(ownerId);
      expect(JSON.stringify(scheduled)).not.toContain(workoutId(1));
      expect(scheduled).toMatchObject({
        title: 'OVRANTO',
        body: 'You have an upcoming workout.',
        dueAt: Date.parse(due(60)),
      });
      expect(await reconcileNativeReminders(f.port, input)).toMatchObject({
        kind: 'ready',
        pending: 1,
      });
      expect(f.port.schedule).toHaveBeenCalledTimes(1);
      expect(f.port.cancel).not.toHaveBeenCalled();
    },
  );
  it('removes pending and presented managed records, preserving unrelated notifications', async () => {
    const f = fixture();
    await reconcileNativeReminders(f.port, input);
    const id = f.rows[1]!.identifier;
    f.presented = [id, REMINDER_PREFIX + 'legacy', 'other'];
    expect(await cancelManagedNativeReminders(f.port)).toEqual({ kind: 'ready', pending: 0 });
    expect(f.rows).toEqual([unrelated]);
    expect(f.presented).toEqual(['other']);
    expect(f.port.dismiss).toHaveBeenCalledTimes(2);
  });
  it('ordinary pending-only cleanup preserves displayed reminders', async () => {
    const f = fixture();
    f.presented = [REMINDER_PREFIX + 'legacy', 'other'];
    expect(await cancelManagedNativeReminders(f.port, false)).toEqual({
      kind: 'ready',
      pending: 0,
    });
    expect(f.port.listPresented).not.toHaveBeenCalled();
    expect(f.port.dismiss).not.toHaveBeenCalled();
  });
  it('still attempts presented cleanup if pending inventory fails and reports failure', async () => {
    const f = fixture();
    f.presented = [REMINDER_PREFIX + 'legacy', 'other'];
    f.port.list.mockRejectedValueOnce(new Error('native unavailable'));
    expect(await cancelManagedNativeReminders(f.port)).toEqual({ kind: 'failed' });
    expect(f.presented).toEqual(['other']);
  });
  it('verifies tray removal, handles ambiguous dismissal, and rejects malformed inventory', async () => {
    const f = fixture();
    f.presented = [REMINDER_PREFIX + 'legacy'];
    f.port.dismiss.mockResolvedValueOnce(undefined);
    expect(await cancelManagedNativeReminders(f.port)).toEqual({ kind: 'failed' });
    const dismiss = f.port.dismiss.getMockImplementation()!;
    f.port.dismiss.mockImplementationOnce(async (id) => {
      await dismiss(id);
      throw new Error('ambiguous');
    });
    expect(await cancelManagedNativeReminders(f.port)).toEqual({ kind: 'ready', pending: 0 });
    f.port.listPresented.mockResolvedValueOnce([null] as never);
    expect(await cancelManagedNativeReminders(f.port)).toEqual({ kind: 'failed' });
  });
  it('exports only the final verified descriptors for foreground admission', async () => {
    const f = fixture();
    const result = await reconcileNativeReminders(f.port, input);
    expect(result).toEqual({
      kind: 'ready',
      pending: 1,
      verified: [{ ...f.port.schedule.mock.calls[0]![0], platform: 'android' }],
    });
    expect(JSON.stringify(result)).not.toContain(ownerId);
    expect(JSON.stringify(result)).not.toContain(workoutId(1));
  });
  it('replaces changed time, locale and owner; cancels stale before scheduling', async () => {
    const f = fixture();
    await reconcileNativeReminders(f.port, input);
    const first = f.rows[1]!.identifier;
    expect(
      await reconcileNativeReminders(f.port, {
        ...input,
        locale: 'uk',
        plan: { kind: 'ready', reminders: [row(1, 120)] },
      }),
    ).toMatchObject({ kind: 'ready', pending: 1 });
    expect(f.port.cancel).toHaveBeenCalledWith(first);
    expect(f.port.cancel.mock.invocationCallOrder[0]).toBeLessThan(
      f.port.schedule.mock.invocationCallOrder[1]!,
    );
    expect(f.port.schedule.mock.calls[1]![0].body).toBe('Наближається час тренування.');
    const second = f.rows[1]!.identifier;
    await reconcileNativeReminders(f.port, { ...input, ownerId: workoutId(99) });
    expect(f.port.cancel).toHaveBeenCalledWith(second);
    expect(f.rows).toHaveLength(2);
  });
  it('blocked, empty or revoked scope clears only managed namespace', async () => {
    for (const change of [
      { plan: { kind: 'blocked' as const, reason: 'consent' as const } },
      { isCurrent: () => false },
      { plan: { kind: 'ready' as const, reminders: [] } },
    ]) {
      const f = fixture();
      await reconcileNativeReminders(f.port, input);
      f.rows.push({ identifier: REMINDER_PREFIX + 'obsolete', content: null, trigger: null });
      await reconcileNativeReminders(f.port, { ...input, ...change });
      expect(f.rows).toEqual([unrelated]);
      expect(f.port.cancel).not.toHaveBeenCalledWith(unrelated.identifier);
    }
  });
  it('does not schedule without permission/channel availability', async () => {
    const f = fixture();
    await reconcileNativeReminders(f.port, input);
    f.port.canSchedule.mockResolvedValue(false);
    expect(await reconcileNativeReminders(f.port, input)).toEqual({ kind: 'blocked' });
    expect(f.rows).toEqual([unrelated]);
    expect(f.port.schedule).toHaveBeenCalledTimes(1);
  });
  it('keeps only earliest candidates within total pending capacity', async () => {
    const f = fixture();
    f.rows = Array.from({ length: 46 }, (_, i) => ({ ...unrelated, identifier: 'other-' + i }));
    const plan = { kind: 'ready' as const, reminders: [row(3, 90), row(1, 30), row(2, 60)] };
    expect(await reconcileNativeReminders(f.port, { ...input, plan })).toMatchObject({
      kind: 'ready',
      pending: 2,
    });
    expect(f.port.schedule.mock.calls.map(([item]) => item.dueAt)).toEqual([
      Date.parse(due(30)),
      Date.parse(due(60)),
    ]);
    expect(f.rows).toHaveLength(48);
  });
  it('skips imminent/past and minute-crossing rounding; rounds remaining to next second', async () => {
    const f = fixture();
    const plan = {
      kind: 'ready' as const,
      reminders: [
        { workoutId: workoutId(1), dueAt: new Date(base + 4999).toISOString() },
        { workoutId: workoutId(2), dueAt: new Date(base + 59999).toISOString() },
        { workoutId: workoutId(3), dueAt: new Date(base + 60123).toISOString() },
        row(4, -1),
      ],
    };
    expect(await reconcileNativeReminders(f.port, { ...input, plan })).toMatchObject({
      kind: 'ready',
      pending: 1,
    });
    expect(f.port.schedule.mock.calls[0]![0].dueAt).toBe(base + 61000);
  });
  it('repairs duplicate or tampered native records before scheduling', async () => {
    const f = fixture();
    await reconcileNativeReminders(f.port, input);
    f.rows.push(structuredClone(f.rows[1]!));
    expect(await reconcileNativeReminders(f.port, input)).toMatchObject({
      kind: 'ready',
      pending: 1,
    });
    expect(f.rows).toHaveLength(2);
    (f.rows[1]!.trigger as { value: number }).value = base;
    expect(await reconcileNativeReminders(f.port, input)).toMatchObject({
      kind: 'ready',
      pending: 1,
    });
    expect(f.port.schedule).toHaveBeenCalledTimes(3);
  });
  it('cancellation failure blocks new scheduling and reports failure', async () => {
    const f = fixture();
    await reconcileNativeReminders(f.port, input);
    f.port.cancel.mockResolvedValue(undefined);
    expect(
      await reconcileNativeReminders(f.port, {
        ...input,
        plan: { kind: 'ready', reminders: [row(2)] },
      }),
    ).toEqual({ kind: 'failed' });
    expect(f.port.schedule).toHaveBeenCalledTimes(1);
    expect(await cancelManagedNativeReminders(f.port)).toEqual({ kind: 'failed' });
  });
  it('ambiguous schedule failure after native commit is cleaned up without replay', async () => {
    const f = fixture();
    const schedule = f.port.schedule.getMockImplementation()!;
    f.port.schedule.mockImplementationOnce(async (item) => {
      await schedule(item);
      throw new Error('native timeout');
    });
    expect(await reconcileNativeReminders(f.port, input)).toEqual({ kind: 'failed' });
    expect(f.rows).toEqual([unrelated]);
    expect(f.port.schedule).toHaveBeenCalledTimes(1);
  });
  it('serializes native operations and cleans up when scope changes during write', async () => {
    const f = fixture();
    let current = true;
    const schedule = f.port.schedule.getMockImplementation()!;
    let entered!: () => void, release!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    f.port.schedule.mockImplementationOnce(async (item) => {
      entered();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return schedule(item);
    });
    const pending = reconcileNativeReminders(f.port, { ...input, isCurrent: () => current });
    await started;
    current = false;
    expect(await cancelManagedNativeReminders(f.port)).toEqual({ kind: 'busy' });
    expect(await reconcileNativeReminders(f.port, input)).toEqual({ kind: 'busy' });
    release();
    expect(await pending).toEqual({ kind: 'failed' });
    expect(f.rows).toEqual([unrelated]);
    expect(await cancelManagedNativeReminders(f.port)).toEqual({ kind: 'ready', pending: 0 });
  });
  it('fails on missing final native record, never claims a delivery', async () => {
    const f = fixture();
    f.port.schedule.mockImplementationOnce(async (item) => item.identifier);
    expect(await reconcileNativeReminders(f.port, input)).toEqual({ kind: 'failed' });
  });
  it('rejects duplicate/invalid desired evidence and does not retain stale reminders', async () => {
    const f = fixture();
    await reconcileNativeReminders(f.port, input);
    expect(
      await reconcileNativeReminders(f.port, {
        ...input,
        plan: { kind: 'ready', reminders: [row(1), row(1)] },
      }),
    ).toEqual({ kind: 'blocked' });
    expect(f.rows).toEqual([unrelated]);
    expect(
      await reconcileNativeReminders(f.port, {
        ...input,
        plan: { kind: 'ready', reminders: [{ ...row(1), dueAt: '2026-02-30T12:00:00Z' }] },
      }),
    ).toEqual({ kind: 'failed' });
  });
});
