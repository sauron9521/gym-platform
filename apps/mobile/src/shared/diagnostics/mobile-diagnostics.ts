import { z } from 'zod';

/** Strict allowlist. No free text, raw exceptions, route parameters or device/account IDs. */
const requestIdSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
const eventSchema = z.discriminatedUnion('kind', [
  z.strictObject({ version: z.literal(1), kind: z.literal('render_failure') }),
  z.strictObject({
    version: z.literal(1),
    kind: z.literal('api_server_failure'),
    status: z.number().int().min(500).max(599),
    requestId: requestIdSchema.optional(),
  }),
]);
export type MobileDiagnosticEvent = Readonly<z.infer<typeof eventSchema>>;
export type DiagnosticsSink = (
  event: MobileDiagnosticEvent,
  signal: AbortSignal,
) => void | Promise<void>;

type PreviewConfiguration = {
  environment: 'development' | 'test' | 'preview' | 'production';
  permissionGranted: boolean;
  sink: DiagnosticsSink;
};

/**
 * In-memory, opt-in preview port. Nothing is persisted or replayed.
 * A future reviewed SDK adapter owns native crash collection, consent and
 * environment verification. The current application never configures a sink.
 */
export function createMobileDiagnostics() {
  let active: {
    sink: DiagnosticsSink;
    controller: AbortController;
    busy: boolean;
    remaining: number;
  } | null = null;

  function disable() {
    const previous = active;
    active = null;
    previous?.controller.abort();
  }

  function configure(config: PreviewConfiguration) {
    disable();
    if (
      config.environment !== 'preview' ||
      config.permissionGranted !== true ||
      typeof config.sink !== 'function'
    )
      return;
    active = { sink: config.sink, controller: new AbortController(), busy: false, remaining: 20 };
  }

  function report(input: MobileDiagnosticEvent) {
    const current = active;
    if (!current || current.busy || current.remaining <= 0) return;
    // Runtime strict validation protects against incorrectly typed callers.
    try {
      const parsed = eventSchema.safeParse(input);
      if (!parsed.success) return;
      current.remaining--;
      current.busy = true;
      const event = Object.freeze(parsed.data);
      void Promise.resolve(current.sink(event, current.controller.signal))
        .catch(() => undefined)
        .finally(() => {
          current.busy = false;
        });
    } catch {
      // Instrumentation must never change the original app operation.
      current.busy = false;
    }
  }

  // A response from an earlier, disabled or revoked permission epoch must
  // not be collected retrospectively under a new configuration.
  function beginApiResponseObservation() {
    const started = active;
    if (!started) return undefined;
    return (response: Pick<Response, 'status' | 'headers'>) => {
      if (active !== started || started.controller.signal.aborted) return;
      try {
        const status = response.status;
        if (!Number.isInteger(status) || status < 500 || status > 599) return;
        const requestId = requestIdSchema.safeParse(response.headers.get('X-Request-ID'));
        report({
          version: 1,
          kind: 'api_server_failure',
          status,
          ...(requestId.success ? { requestId: requestId.data } : {}),
        });
      } catch {
        // No fallback to body, URL, headers dump, or exception text.
      }
    };
  }

  return { configure, disable, report, beginApiResponseObservation };
}

export const mobileDiagnostics = createMobileDiagnostics();
