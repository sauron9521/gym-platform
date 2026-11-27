import { NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { describe, expect, it } from 'vitest';

import type { AppConfigService } from '#src/common/config/app-config.types';
import { HttpMetricsController } from './http-metrics.controller.js';
import type { NotificationQueueMetricsService } from './notification-queue-metrics.service.js';
import { HttpMetricsRegistry } from './http-metrics.registry.js';

const TOKEN = 'k'.repeat(43);

function controller(
  enabled: boolean,
  secret?: string,
  render = vi.fn().mockResolvedValue('queue_snapshot\n'),
): HttpMetricsController {
  const config = {
    get(key: string) {
      if (key === 'HTTP_METRICS_ENABLED') return enabled;
      if (key === 'HTTP_METRICS_TOKEN') return secret;
      return undefined;
    },
  } as unknown as AppConfigService;
  return new HttpMetricsController(config, new HttpMetricsRegistry(), {
    render,
  } as unknown as NotificationQueueMetricsService);
}

function request(token: unknown): Request {
  return {
    headers: { authorization: typeof token === 'string' ? 'Bearer ' + token : token },
  } as unknown as Request;
}

describe('HttpMetricsController', () => {
  it('is disabled by default, including for requests with a token', async () => {
    const render = vi.fn();
    await expect(controller(false, TOKEN, render).metrics(request(TOKEN))).rejects.toThrow(
      NotFoundException,
    );
    expect(render).not.toHaveBeenCalled();
  });

  it('does not reveal metrics to absent, malformed, or incorrect tokens', async () => {
    const render = vi.fn();
    const endpoint = controller(true, TOKEN, render);
    for (const input of [undefined, '', 'wrong', ['wrong'], TOKEN + 'x']) {
      await expect(endpoint.metrics(request(input))).rejects.toThrow(NotFoundException);
    }
    expect(render).not.toHaveBeenCalled();
  });

  it('returns only sanitized Prometheus exposition for a valid token', async () => {
    const endpoint = controller(true, TOKEN);
    const text = await endpoint.metrics(request(TOKEN));
    expect(text).toContain('gym_api_http_requests_total{status_class="2xx"} 0');
    expect(text).toContain('gym_api_http_request_duration_seconds_bucket{le="+Inf"} 0');
    expect(text).not.toContain(TOKEN);
    expect(text).toContain('queue_snapshot');
  });

  it('does not enable an unconfigured scrape endpoint', async () => {
    await expect(controller(true).metrics(request(TOKEN))).rejects.toThrow(NotFoundException);
  });
});
