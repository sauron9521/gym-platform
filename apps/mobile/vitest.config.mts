import { defineConfig } from 'vitest/config';
import { reactNative } from 'vitest-native';

// Pilot: exercise the real React Native JavaScript component tree. Native device
// modules are still mocked; Maestro remains the device-level E2E gate.
export default defineConfig({
  plugins: [reactNative({ engine: 'native' })],
  test: {
    environment: 'node',
    include: ['test/vitest/**/*.test.{ts,tsx}'],
    clearMocks: true,
  },
});
