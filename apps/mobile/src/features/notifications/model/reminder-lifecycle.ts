import type { Locale } from '@gym/i18n';
import {
  hasAthleteAccess,
  type AccountCapabilities,
} from '@/features/auth/model/account-capabilities';
import type { PrivateDataLifecycle } from '@/features/auth/model/private-data-lifecycle';
import type { InboxScope } from '../services/inbox-api';
import type { PreparedReminderPlan } from './prepare-local-reminders';
import type { NativeReminderPort, ReconcileResult } from '../lib/native-reminder-reconciliation';

import { ForegroundReminderAdmission } from '../lib/foreground-reminder-admission';

type Context = { scope: InboxScope; locale: Locale };
type Dependencies = {
  enabled: boolean;
  foreground: () => boolean;
  online: () => boolean;
  openPort: () => Promise<NativeReminderPort | null>;
  prepare: (scope: InboxScope, signal: AbortSignal) => Promise<PreparedReminderPlan>;
  reconcile: (
    port: NativeReminderPort,
    input: {
      ownerId: string;
      locale: Locale;
      plan: PreparedReminderPlan['plan'];
      isCurrent: () => boolean;
    },
  ) => Promise<ReconcileResult>;
  cancel: (port: NativeReminderPort) => Promise<ReconcileResult>;
};

/** Network preparation is outside the native queue: a current 401 can await
 * auth end() without deadlocking on its own request. All native operations,
 * including logout cleanup, are serialized. */
export class ReminderLifecycle implements PrivateDataLifecycle {
  private generation = 0;
  private owner: string | null = null;
  private context: Context | null = null;
  private controller: AbortController | null = null;
  private nativeQueue: Promise<void> = Promise.resolve();
  private cleanupRequired = true;
  private pendingRefresh = false;
  private preparing = false;
  private queuedCleanup: Promise<void> | null = null;
  private foregroundHandlerReady = false;
  private readonly admission = new ForegroundReminderAdmission();

  constructor(private readonly deps: Dependencies) {}

  private invalidate() {
    this.admission.clear();
    ++this.generation;
    this.controller?.abort();
    this.controller = null;
    this.pendingRefresh = false;
  }

  setForegroundHandlerReady(ready: boolean) {
    if (this.foregroundHandlerReady === ready) return;
    this.foregroundHandlerReady = ready;
    if (!ready) {
      this.invalidate();
      void this.requestCleanup();
    } else if (this.context) this.refresh();
  }

  admitForeground(notification: unknown, now = Date.now()) {
    return (
      this.deps.enabled &&
      this.foregroundHandlerReady &&
      !this.cleanupRequired &&
      !!this.context &&
      this.context.scope.ownerId === this.owner &&
      this.context.scope.isCurrent() &&
      this.deps.foreground() &&
      this.deps.online() &&
      this.admission.consume(notification, now)
    );
  }

  private enqueue(operation: () => Promise<void>) {
    const result = this.nativeQueue.then(operation);
    this.nativeQueue = result.catch(() => undefined);
    return result;
  }

  private async cleanup(port?: NativeReminderPort) {
    this.cleanupRequired = true;
    try {
      const native = port ?? (await this.deps.openPort());
      if (!native) return;
      const result = await this.deps.cancel(native);
      this.cleanupRequired = result.kind !== 'ready' || result.pending !== 0;
    } catch {
      // Retry cleanup on the next lifecycle event, never report false success.
    }
  }

  private requestCleanup() {
    this.cleanupRequired = true;
    if (this.queuedCleanup) return this.queuedCleanup;
    const result = this.enqueue(() => this.cleanup());
    this.queuedCleanup = result;
    void result.finally(() => {
      if (this.queuedCleanup === result) this.queuedCleanup = null;
    });
    return result;
  }

  lock() {
    this.invalidate();
    this.owner = null;
    this.context = null;
    // Normal backgrounding preserves previously verified OS reminders.
    // Active sign-in/reverification locks must clear previous ownership.
    if (this.deps.foreground()) void this.requestCleanup();
  }

  verified(ownerId: string, capabilities: AccountCapabilities) {
    if (!hasAthleteAccess(capabilities)) return this.end();
    this.invalidate();
    this.owner = ownerId;
    this.context = null;
    // Includes cold launch, same-account re-verification and account switch.
    // No new native write before verified cleanup of previous ownership.
    return this.requestCleanup();
  }

  end() {
    this.invalidate();
    this.owner = null;
    this.context = null;
    // End never skips cleanup, even if a newer verification is queued.
    return this.requestCleanup();
  }

  update(context: Context | null) {
    if (context && context.scope.ownerId === this.owner) {
      this.context = context;
      this.refresh();
    } else {
      this.invalidate();
      this.context = null;
      if (this.deps.foreground()) void this.requestCleanup();
    }
  }

  /** Called on relevant events by the composition boundary. No polling or
   * hidden/background GET. Coalesce bursts while a read is settling. */
  refresh() {
    this.invalidate();
    if (!this.deps.foreground()) return;
    void this.requestCleanup();
    if (
      !this.deps.enabled ||
      !this.foregroundHandlerReady ||
      !this.owner ||
      !this.context ||
      !this.deps.online()
    ) {
      return;
    }
    this.pendingRefresh = true;
    if (!this.preparing) void this.drain();
  }

  private async drain() {
    this.preparing = true;
    try {
      while (this.pendingRefresh) {
        this.pendingRefresh = false;
        const context = this.context;
        const generation = this.generation;
        const controller = new AbortController();
        this.controller = controller;
        const current = () =>
          this.deps.enabled &&
          this.foregroundHandlerReady &&
          !controller.signal.aborted &&
          generation === this.generation &&
          context !== null &&
          context.scope.ownerId === this.owner &&
          context.scope.isCurrent() &&
          this.deps.foreground() &&
          this.deps.online();
        let prepared: PreparedReminderPlan | undefined;
        try {
          if (!context || !current()) continue;
          prepared = await this.deps.prepare(context.scope, controller.signal);
          if (!current()) continue;
          const evidence = prepared;
          await this.enqueue(async () => {
            if (!current()) return;
            const port = await this.deps.openPort();
            if (!port) {
              this.cleanupRequired = true;
              return;
            }
            if (!current() || this.cleanupRequired) return;
            if (evidence.plan.kind !== 'ready' || !evidence.isCurrent()) {
              await this.cleanup(port);
              return;
            }
            const result = await this.deps.reconcile(port, {
              ownerId: context.scope.ownerId,
              locale: context.locale,
              plan: evidence.plan,
              isCurrent: () => current() && evidence.isCurrent(),
            });
            if (result.kind !== 'ready' || !current() || !evidence.isCurrent()) {
              await this.cleanup(port);
            } else {
              this.admission.replace(result.verified ?? [], result.pending);
            }
          });
        } catch {
          // Failure is not proof of cleanup; block and reconcile later.
          if (current()) await this.enqueue(() => this.cleanup());
        } finally {
          prepared?.dispose();
          if (this.controller === controller) this.controller = null;
        }
      }
    } finally {
      this.preparing = false;
    }
  }
}
