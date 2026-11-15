import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { test } from '@playwright/test';

// Temporary diagnostic spec. Remove before merge.
test('print exact repo Prettier patch for two new files', () => {
  const root = fileURLToPath(new URL('../../../../', import.meta.url));
  const paths = [
    'apps/web/src/features/training-programs/lib/create-training-program.ts',
    'apps/web/src/features/training-programs/ui/create-training-program-form.tsx',
  ];
  execFileSync('pnpm', ['exec', 'prettier', '--write', ...paths], { cwd: root });
  const diff = execFileSync('git', ['diff', '--', ...paths], { cwd: root, encoding: 'utf8' });
  console.log('=== PRETTIER EXPECTED DIFF BEGIN ===');
  console.log(diff);
  console.log('=== PRETTIER EXPECTED DIFF END ===');
});
