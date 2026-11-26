import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createMobileDiagnostics,
  mobileDiagnostics,
  type MobileDiagnosticEvent,
} from '@/shared/diagnostics/mobile-diagnostics';
import { createMobileApi } from '@/shared/api/client';

const requestId = '12345678-1234-4123-8123-123456789abc';
const renderFailure = { version: 1, kind: 'render_failure' } as const;
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};
const response = (status: number, id?: string) =>
  ({
    status,
    headers: { get: vi.fn(() => id ?? null) },
  }) as unknown as Pick<Response, 'status' | 'headers'>;

afterEach(() => {
  mobileDiagnostics.disable();
  vi.unstubAllGlobals();
});
describe('privacy-safe mobile diagnostic port', () => {
  it('is disabled by default and only allows explicitly permitted preview', () => {
    const d = createMobileDiagnostics();
    const sink = vi.fn();
    d.report(renderFailure);
    expect(d.beginApiResponseObservation()).toBeUndefined();
    for (const environment of ['development', 'test', 'production'] as const) {
      d.configure({ environment, permissionGranted: true, sink });
      d.report(renderFailure);
      expect(d.beginApiResponseObservation()).toBeUndefined();
    }
    d.configure({ environment: 'preview', permissionGranted: false, sink });
    d.report(renderFailure);
    expect(sink).not.toHaveBeenCalled();
    d.configure({ environment: 'preview', permissionGranted: true, sink });
    d.report(renderFailure);
    expect(sink).toHaveBeenCalledExactlyOnceWith(renderFailure, expect.any(AbortSignal));
  });

  it('rejects arbitrary fields, event names, status and malformed IDs at runtime', () => {
    const d = createMobileDiagnostics();
    const sink = vi.fn();
    d.configure({ environment: 'preview', permissionGranted: true, sink });
    for (const payload of [
      { ...renderFailure, message: 'Bearer secret' },
      { ...renderFailure, stack: 'private-workout' },
      { ...renderFailure, user: { id: requestId } },
      { version: 1, kind: 'private workout title' },
      { version: 1, kind: 'api_server_failure', status: 429, requestId },
      { version: 1, kind: 'api_server_failure', status: 500, requestId: 'Bearer secret' },
      { version: 2, kind: 'render_failure' },
    ])
      d.report(payload as MobileDiagnosticEvent);
    expect(sink).not.toHaveBeenCalled();
  });

  it('observes only 5xx and reads exactly one response header, never body or URL', async () => {
    const d = createMobileDiagnostics();
    const sink = vi.fn();
    d.configure({ environment: 'preview', permissionGranted: true, sink });
    const observe = d.beginApiResponseObservation()!;
    for (const status of [200, 401, 403, 409, 429]) {
      const r = response(status, requestId);
      observe(r);
      expect(r.headers.get).not.toHaveBeenCalled();
    }
    expect(sink).not.toHaveBeenCalled();
    const r = response(503, requestId);
    Object.defineProperty(r, 'body', {
      get: () => {
        throw new Error('body accessed');
      },
    });
    Object.defineProperty(r, 'url', {
      get: () => {
        throw new Error('URL accessed');
      },
    });
    observe(r);
    expect(r.headers.get).toHaveBeenCalledExactlyOnceWith('X-Request-ID');
    expect(sink).toHaveBeenCalledExactlyOnceWith(
      { version: 1, kind: 'api_server_failure', status: 503, requestId },
      expect.any(AbortSignal),
    );
    await flush();
    observe(response(500, 'private@email.example'));
    expect(sink).toHaveBeenLastCalledWith(
      { version: 1, kind: 'api_server_failure', status: 500 },
      expect.any(AbortSignal),
    );
  });

  it('revokes permission and ignores responses that started under earlier epochs', () => {
    const d = createMobileDiagnostics();
    const first = vi.fn();
    const second = vi.fn();
    expect(d.beginApiResponseObservation()).toBeUndefined();
    d.configure({ environment: 'preview', permissionGranted: true, sink: first });
    const old = d.beginApiResponseObservation()!;
    d.report(renderFailure);
    const signal = first.mock.calls[0]?.[1] as AbortSignal;
    d.disable();
    expect(signal.aborted).toBe(true);
    d.configure({ environment: 'preview', permissionGranted: true, sink: second });
    old(response(500, requestId));
    expect(second).not.toHaveBeenCalled();
    d.beginApiResponseObservation()?.(response(500, requestId));
    expect(second).toHaveBeenCalledOnce();
  });

  it('never queues reports and bounds each permission epoch to 20 attempted deliveries', async () => {
    const d = createMobileDiagnostics();
    let settle = () => {};
    const sink = vi.fn().mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          settle = resolve;
        }),
    );
    d.configure({ environment: 'preview', permissionGranted: true, sink });
    d.report(renderFailure);
    for (let i = 0; i < 10; i++) d.report(renderFailure);
    expect(sink).toHaveBeenCalledOnce();
    settle();
    await flush();
    for (let i = 0; i < 30; i++) {
      d.report(renderFailure);
      await flush();
    }
    expect(sink).toHaveBeenCalledTimes(20);
  });

  it('ignores synchronous or asynchronous sink failures without exposing exception details', async () => {
    const d = createMobileDiagnostics();
    const sink = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('private sync');
      })
      .mockRejectedValueOnce(new Error('private async'));
    d.configure({ environment: 'preview', permissionGranted: true, sink });
    expect(() => d.report(renderFailure)).not.toThrow();
    expect(() => d.report(renderFailure)).not.toThrow();
    await flush();
    d.report(renderFailure);
    expect(sink).toHaveBeenCalledTimes(3);
  });
});
describe('mobile API diagnostics integration', () => {
  it('preserves response body, bearer auth and auth callbacks while reporting only 5xx status/id', async () => {
    const sink = vi.fn();
    mobileDiagnostics.configure({ environment: 'preview', permissionGranted: true, sink });
    const errorBody = { message: 'private workout payload' };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(errorBody), {
          status: 503,
          headers: { 'Content-Type': 'application/json', 'X-Request-ID': requestId },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'denied' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetch);
    const onAuthFailure = vi.fn();
    const api = createMobileApi(
      'https://api.example.invalid',
      () => 'private-bearer',
      onAuthFailure,
    );
    const failed = await api.GET('/workouts');
    expect(failed.response.status).toBe(503);
    expect(failed.error).toEqual(errorBody);
    expect(fetch.mock.calls[0]?.[0].headers.get('authorization')).toBe('Bearer private-bearer');
    expect(sink).toHaveBeenCalledExactlyOnceWith(
      { version: 1, kind: 'api_server_failure', status: 503, requestId },
      expect.any(AbortSignal),
    );
    await api.GET('/workouts');
    expect(onAuthFailure).toHaveBeenCalledExactlyOnceWith('unauthenticated');
    expect(sink).toHaveBeenCalledOnce();
  });

  it('does not report network rejection and does not retroactively report after permission change', async () => {
    let finish: (value: Response) => void = () => {};
    let started: () => void = () => {};
    const wait = new Promise<void>((resolve) => {
      started = resolve;
    });
    const fetch = vi
      .fn()
      .mockImplementationOnce(() => {
        started();
        return new Promise<Response>((resolve) => {
          finish = resolve;
        });
      })
      .mockRejectedValueOnce(new Error('private network reason'));
    vi.stubGlobal('fetch', fetch);
    const api = createMobileApi('https://api.example.invalid', () => null);
    const inFlight = api.GET('/workouts');
    await wait;
    const sink = vi.fn();
    mobileDiagnostics.configure({ environment: 'preview', permissionGranted: true, sink });
    finish(
      new Response('{}', {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'X-Request-ID': requestId },
      }),
    );
    await inFlight;
    await expect(api.GET('/workouts')).rejects.toThrow('private network reason');
    expect(sink).not.toHaveBeenCalled();
  });
});
