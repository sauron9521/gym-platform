import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Controller, HttpCode, type INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { getWebAppOrigin } from '../../../src/common/config/http.config.js';

@Controller('csrf-probe')
class CsrfProbeController {
  @Post()
  @HttpCode(200)
  probe() {
    return { ok: true };
  }
}

describe('CSRF trusted web origin (HTTP)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [CsrfProbeController],
    }).compile();

    app = module.createNestApplication();
    app.enableCsrfProtection({
      trustedOrigins: [getWebAppOrigin('https://web.example.test')],
    });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('allows browser writes from the configured web origin', async () => {
    const response = await request(app.getHttpServer())
      .post('/csrf-probe')
      .set('Origin', 'https://web.example.test')
      .set('Sec-Fetch-Site', 'same-site');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it('rejects browser writes from an untrusted origin', async () => {
    const response = await request(app.getHttpServer())
      .post('/csrf-probe')
      .set('Origin', 'https://untrusted.example.test')
      .set('Sec-Fetch-Site', 'cross-site');

    expect(response.status).toBe(403);
  });
});
