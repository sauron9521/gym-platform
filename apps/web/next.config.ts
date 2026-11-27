import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

import { getApiUpstreamOrigin } from './src/shared/api/upstream.mjs';

const nextConfig: NextConfig = {
  ...(process.env.GYM_WEB_STANDALONE === 'true'
    ? {
        output: 'standalone',
        outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
      }
    : {}),
  reactStrictMode: true,
  transpilePackages: ['@gym/api-client', '@gym/domain', '@gym/i18n', '@gym/ui-web'],
  async rewrites() {
    // Session cookies are scoped to the web origin, even with a separate API host.
    return [
      {
        source: '/backend/:path*',
        destination: getApiUpstreamOrigin(process.env.GYM_API_INTERNAL_URL) + '/:path*',
      },
    ];
  },
};

export default createNextIntlPlugin('./src/i18n/request.ts')(nextConfig);
