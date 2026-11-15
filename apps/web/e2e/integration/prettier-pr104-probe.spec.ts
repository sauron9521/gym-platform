import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { test } from '@playwright/test';

// Temporary formatting diagnostic; remove this spec before merging the PR.
test('print the repository Prettier diff for workout day files', () => {
  const root = fileURLToPath(new URL('../../../../', import.meta.url));
  const paths = [
    'apps/web/e2e/integration/trainer-program-workout-create.spec.ts',
    'apps/web/src/features/training-programs/lib/create-program-workout.ts',
    'apps/web/src/features/training-programs/ui/training-program-workouts.tsx',
    'apps/web/test/create-program-workout.test.mjs',
  ];
  execFileSync('pnpm', ['exec', 'prettier', '--write', ...paths], { cwd: root });
  const diff = execFileSync('git', ['diff', '--', ...paths], {
    cwd: root,
    encoding: 'utf8',
  });
  console.log('=== PR104 PRETTIER DIFF BEGIN ===');
  console.log(diff);
  console.log('=== PR104 PRETTIER DIFF END ===');
});
