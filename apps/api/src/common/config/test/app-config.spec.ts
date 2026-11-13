import { describe, expect, it } from 'vitest';

import { getCorsOrigins, getWebAppOrigin } from '../http.config.js';
import { getLogLevels } from '../logger.config.js';

describe('typed application config helpers', () => {
  it('normalizes the already validated comma-separated CORS origins', () => {
    expect(getCorsOrigins('https://a.example.test, https://b.example.test')).toEqual([
      'https://a.example.test',
      'https://b.example.test',
    ]);
  });

  it('trusts only the configured web app origin, not arbitrary CORS origins', () => {
    expect(getWebAppOrigin('https://web.example.test/verify-email')).toBe(
      'https://web.example.test',
    );
    expect(getWebAppOrigin('http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('keeps only the selected and more severe log levels', () => {
    expect(getLogLevels('error')).toEqual(['fatal', 'error']);
    expect(getLogLevels('warn')).toEqual(['fatal', 'error', 'warn']);
    expect(getLogLevels('log')).toEqual(['fatal', 'error', 'warn', 'log']);
    expect(getLogLevels('debug')).toEqual(['fatal', 'error', 'warn', 'log', 'debug']);
    expect(getLogLevels('verbose')).toHaveLength(6);
  });
});
