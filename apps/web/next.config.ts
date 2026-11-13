import type { NextConfig } from 'next';

import { getApiUpstreamOrigin } from './src/shared/api/upstream.mjs';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@gym/api-client'],
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

export default nextConfig;
