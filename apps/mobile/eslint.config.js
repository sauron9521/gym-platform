const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/**', '.expo/**', 'android/**', 'ios/**'],
  },
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/entities',
                '@/entities/**',
                '@/features',
                '@/features/**',
                '@/widgets',
                '@/widgets/**',
                '@/screens',
                '@/screens/**',
                '@/app',
                '@/app/**',
              ],
              message: 'Mobile shared code cannot import features, screens or routes.',
            },
          ],
        },
      ],
    },
  },
]);
