import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  ...(process.env.GYM_LANDING_STANDALONE === 'true'
    ? {
        output: 'standalone',
        outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
      }
    : {}),
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  transpilePackages: ['@gym/i18n', '@gym/ui-web'],
};

export default createNextIntlPlugin('./src/i18n/request.ts')(nextConfig);
