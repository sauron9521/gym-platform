import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

import { getAdminApiOrigin } from './src/shared/api/upstream.mjs';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@gym/api-client', '@gym/i18n', '@gym/ui-web'],
  async headers() {
    return ['/users', '/users/:id', '/notifications'].map((source) => ({
      source,
      headers: [
        { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
      ],
    }));
  },
  async rewrites() {
    return [
      {
        source: '/backend/:path*',
        destination: getAdminApiOrigin(process.env.GYM_API_INTERNAL_URL) + '/:path*',
      },
    ];
  },
};

export default createNextIntlPlugin('./src/i18n/request.ts')(nextConfig);
