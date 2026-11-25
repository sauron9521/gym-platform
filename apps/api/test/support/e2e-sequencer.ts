import { relative, sep } from 'node:path';

import { BaseSequencer, type TestSpecification } from 'vitest/node';

// Rounded median test durations from eight successful main CI runs on 2026-11-25.
// Store the expensive files explicitly. Other and newly added specs share an estimate.
const measuredTestMs = new Map([
  ['test/e2e/trainer-athletes/trainer-athlete-exercise-copy.e2e-spec.ts', 3000],
  ['test/e2e/trainer-athletes/trainer-athletes.e2e-spec.ts', 16300],
  ['test/e2e/trainer-onboarding/trainer-applications.e2e-spec.ts', 4000],
  ['test/e2e/trainer-onboarding/trainer-review.e2e-spec.ts', 4900],
  ['test/e2e/users/admin-account-atomic.e2e-spec.ts', 3800],
  ['test/e2e/users/admin-users.e2e-spec.ts', 14100],
  ['test/e2e/users/users.e2e-spec.ts', 3400],
  ['test/e2e/workouts/workouts.e2e-spec.ts', 10600],
  ['test/integration/auth/admin-mfa-enrollment.integration.e2e-spec.ts', 16100],
  ['test/integration/auth/auth-email-verification.integration.e2e-spec.ts', 4000],
  ['test/integration/auth/auth-password-reset.integration.e2e-spec.ts', 7200],
  ['test/integration/auth/auth-session-management.integration.e2e-spec.ts', 9800],
  ['test/integration/auth/auth-token-flow.integration.e2e-spec.ts', 7400],
  ['test/integration/auth/auth-verification-resend-user-throttle.integration.e2e-spec.ts', 3300],
]);

const defaultTestMs = 650;
const fileOverheadMs = 550;
// CI runs E2E typechecking, schema checks, OpenAPI validation, and the restore drill on shard 1.
const firstShardOverheadMs = 22_000;

export class ApiE2eSequencer extends BaseSequencer {
  override async shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const { root, shard } = this.ctx.config;
    if (shard?.count !== 2 || files.length < 2) return super.shard(files);

    const [heaviest, next, ...remainder] = files
      .map((spec) => {
        const path = relative(root, spec.moduleId).split(sep).join('/');
        const cost = (measuredTestMs.get(path) ?? defaultTestMs) + fileOverheadMs;
        return { spec, path, cost };
      })
      .sort((a, b) => b.cost - a.cost || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

    // Seed both shards even when a filtered run selects only a few files.
    const first = { specs: [next.spec], load: next.cost + firstShardOverheadMs };
    const second = { specs: [heaviest.spec], load: heaviest.cost };
    for (const { spec, cost } of remainder) {
      const target = first.load <= second.load ? first : second;
      target.specs.push(spec);
      target.load += cost;
    }

    return shard.index === 1 ? first.specs : second.specs;
  }
}
