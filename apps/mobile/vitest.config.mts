import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { defineConfig } from 'vitest/config';
import { reactNative } from 'vitest-native';

// The native renderer and hook dependencies must share Expo's React singleton,
// even when pnpm hoists the same query library for a newer Next.js React.
const mobileRequire = createRequire(import.meta.url);
const react = dirname(mobileRequire.resolve('react/package.json'));

// Pilot: exercise the real React Native JavaScript component tree. Native device
// modules are still mocked; Maestro remains the device-level E2E gate.
export default defineConfig({
  plugins: [reactNative({ engine: 'native' })],
  resolve: { alias: { react } },
  test: {
    server: { deps: { inline: [/@tanstack\/react-query/] } },
    environment: 'node',
    include: ['test/vitest/**/*.test.{ts,tsx}'],
    clearMocks: true,
  },
});
