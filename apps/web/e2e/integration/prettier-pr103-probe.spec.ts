import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { test } from '@playwright/test';

// Temporary diagnostic. Remove from the branch before merge.
test('emit exact Prettier diff for the four newly added files', () => {
  const root = fileURLToPath(new URL('../../../../', import.meta.url));
  const paths = [
    'apps/web/e2e/integration/trainer-program-draft-edit.spec.ts',
    'apps/web/e2e/integration/trainer-program-published-readonly.spec.ts',
    'apps/web/src/features/training-programs/ui/trainer-program-details.tsx',
    'apps/web/test/edit-training-program-draft.test.mjs',
  ];
  execFileSync('pnpm', ['exec', 'prettier', '--write', ...paths], { cwd: root });
  const diff = execFileSync('git', ['diff', '--', ...paths], { cwd: root, encoding: 'utf8' });
  console.log('=== PRETTIER PR103 DIFF BEGIN ===');
  console.log(diff);
  console.log('=== PRETTIER PR103 DIFF END ===');
});
