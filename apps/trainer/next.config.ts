import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

import { getTrainerApiOrigin } from './src/shared/api/upstream.mjs';

const nextConfig: NextConfig = {
  ...(process.env.GYM_TRAINER_STANDALONE === 'true'
    ? {
        output: 'standalone',
        outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
      }
    : {}),
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ['@gym/api-client', '@gym/i18n', '@gym/ui-web'],
  async rewrites() {
    return [
      {
        source: '/backend/:path*',
        destination: getTrainerApiOrigin(process.env.GYM_API_INTERNAL_URL) + '/:path*',
      },
    ];
  },
};

export default createNextIntlPlugin('./src/i18n/request.ts')(nextConfig);
