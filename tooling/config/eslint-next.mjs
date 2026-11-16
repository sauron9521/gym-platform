import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
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
                '@/pages',
                '@/pages/**',
                '@/app',
                '@/app/**',
              ],
              message: 'FSD shared code must not depend on higher layers.',
            },
          ],
        },
      ],
    },
  },
]);
