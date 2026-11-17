import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

import { getApiUpstreamOrigin } from './src/shared/api/upstream.mjs';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@gym/api-client', '@gym/i18n', '@gym/ui-web'],
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
