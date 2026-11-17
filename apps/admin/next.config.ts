import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@gym/api-client', '@gym/i18n', '@gym/ui-web'],
};

export default createNextIntlPlugin('./src/i18n/request.ts')(nextConfig);
