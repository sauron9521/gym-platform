import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'vitest';

import { checkFeatureDependencies } from './check-feature-dependencies.mjs';

function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'gym-feature-deps-'));
  const write = (path, source) => {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, source);
  };
  const module = (name, source = 'export class FeatureModule {}') => {
    write('src/modules/' + name + '/' + name + '.module.ts', source);
  };
  const source = (moduleName, path, content) => {
    write('src/modules/' + moduleName + '/' + path, content);
  };

  try {
    run({ write, module, source, check: () => checkFeatureDependencies(root) });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('accepts a dependency-free feature and missing optional domain folders', () => {
  fixture(({ module, check }) => {
    module('one');
    assert.deepEqual(check(), []);
  });
});

test('allows a Nest dependency and its runtime service contract', () => {
  fixture(({ module, source, check }) => {
    module(
      'first',
      "import { SecondModule } from '#src/modules/second/second.module';\nexport class FirstModule {}",
    );
    module('second', '@Module({ exports: [SecondService] }) export class SecondModule {}');
    source(
      'first',
      'services/first.service.ts',
      "import { SecondService } from '#src/modules/second/services/second.service';",
    );
    assert.deepEqual(check(), []);
  });
});

test('type-only cycles are not runtime cycles, including inline type imports', () => {
  fixture(({ module, source, check }) => {
    module('first');
    module('second');
    source(
      'first',
      'types/first.types.ts',
      "import type { Second } from '#src/modules/second/types/second.types';",
    );
    source(
      'second',
      'types/second.types.ts',
      "import { type First } from '#src/modules/first/types/first.types';",
    );
    assert.deepEqual(check(), []);
  });
});

test('a runtime service edge and reverse type-only import are allowed', () => {
  fixture(({ module, source, check }) => {
    module('first', "import { SecondModule } from '#src/modules/second/second.module';");
    module('second', '@Module({ exports: [SecondService] }) export class SecondModule {}');
    source(
      'first',
      'services/first.service.ts',
      "import { SecondService } from '#src/modules/second/services/second.service';",
    );
    source(
      'second',
      'types/second.types.ts',
      "import type { FirstDto } from '#src/modules/first/types/first.types';",
    );
    assert.deepEqual(check(), []);
  });
});

test('rejects a Nest module circular dependency', () => {
  fixture(({ module, check }) => {
    module('first', "import { SecondModule } from '#src/modules/second/second.module';");
    module('second', "import { FirstModule } from '#src/modules/first/first.module';");
    const problems = check().join('\n');
    assert.match(problems, /Nest module dependency cycle: first -> second -> first/);
    assert.match(problems, /Runtime feature dependency cycle: first -> second -> first/);
  });
});

test('detects a runtime cycle through domain services', () => {
  fixture(({ module, source, check }) => {
    module('first', "import { SecondModule } from '#src/modules/second/second.module';");
    module('second', "import { ThirdModule } from '#src/modules/third/third.module';");
    module('third', "import { FirstModule } from '#src/modules/first/first.module';");
    source(
      'first',
      'services/first.service.ts',
      "import { SecondService } from '#src/modules/second/services/second.service';",
    );
    source(
      'second',
      'services/second.service.ts',
      "import { ThirdService } from '#src/modules/third/services/third.service';",
    );
    source(
      'third',
      'services/third.service.ts',
      "import { FirstService } from '#src/modules/first/services/first.service';",
    );
    assert.match(
      check().join('\n'),
      /Runtime feature dependency cycle: first -> second -> third -> first/,
    );
  });
});

test('forbids imports of another feature controller and private repository', () => {
  fixture(({ module, source, check }) => {
    module('first', "import { SecondModule } from '#src/modules/second/second.module';");
    module('second');
    source(
      'first',
      'services/first.service.ts',
      "import { SecondController } from '#src/modules/second/controllers/second.controller';\n" +
        "import { SecondRepository } from '#src/modules/second/repositories/second.repository';",
    );
    const issues = check().join('\n');
    assert.match(issues, /private cross-feature import.*controllers\/second.controller/);
    assert.match(issues, /private cross-feature import.*repositories\/second.repository/);
  });
});

test('Workouts imports public Exercises read contracts, never private policy or select', () => {
  fixture(({ module, source, check }) => {
    module('exercises');
    module(
      'workouts',
      "import { ExercisesModule } from '#src/modules/exercises/exercises.module';",
    );
    source(
      'workouts',
      'repositories/workout-creation.repository.ts',
      "import { buildExerciseVisibilityWhere, workoutExerciseReferenceSelect } from '#src/modules/exercises/public-api';",
    );
    assert.deepEqual(check(), []);

    for (const internal of ['policies/exercise-access.policy', 'selects/exercise.select']) {
      source(
        'workouts',
        'repositories/workout-creation.repository.ts',
        "import { internalContract } from '#src/modules/exercises/" + internal + "';",
      );
      assert.match(check().join('\\n'), /private cross-feature import/);
    }

    source(
      'workouts',
      'repositories/workout-creation.repository.ts',
      "import { buildExerciseVisibilityWhere, workoutExerciseReferenceSelect } from '#src/modules/exercises/public-api';",
    );
    assert.deepEqual(check(), []);
  });
});

test('Workout Analytics uses the public Workouts athlete policy, not private internals', () => {
  fixture(({ module, source, check }) => {
    module('workout-analytics');
    module('workouts');
    source(
      'workout-analytics',
      'services/workout-analytics.service.ts',
      "import { assertWorkoutAthlete } from '#src/modules/workouts/public-api';",
    );
    assert.deepEqual(check(), []);

    source(
      'workout-analytics',
      'services/workout-analytics.service.ts',
      "import { assertWorkoutAthlete } from '#src/modules/workouts/policies/workout-access.policy';",
    );
    assert.match(check().join(' '), /private cross-feature import/);

    source(
      'workout-analytics',
      'services/workout-analytics.service.ts',
      "import type { WorkoutActor } from '#src/modules/workouts/types/workout.types';",
    );
    assert.deepEqual(check(), []);
  });
});

test('UsersRepository is private to Users, including Trainer–Athletes and Auth imports', () => {
  fixture(({ module, source, check }) => {
    module('auth', "import { UsersModule } from '#src/modules/users/users.module';");
    module('trainer-athletes', "import { UsersModule } from '#src/modules/users/users.module';");
    module(
      'users',
      '@Module({ exports: [UsersService, UsersAuthFacade] }) export class UsersModule {}',
    );
    source(
      'auth',
      'services/credentials.service.ts',
      "import { UsersAuthFacade } from '#src/modules/users/services/users-auth.facade';",
    );
    source(
      'trainer-athletes',
      'services/relationship.service.ts',
      "import { UsersService } from '#src/modules/users/services/users.service';",
    );
    assert.deepEqual(check(), []);

    source(
      'auth',
      'services/credentials.service.ts',
      "import { UsersRepository } from '#src/modules/users/repositories/users.repository';",
    );
    assert.match(check().join('\n'), /private cross-feature import/);
    source(
      'auth',
      'services/credentials.service.ts',
      "import { UsersAuthFacade } from '#src/modules/users/services/users-auth.facade';",
    );

    source(
      'trainer-athletes',
      'services/relationship.service.ts',
      "import { UsersRepository } from '#src/modules/users/repositories/users.repository';",
    );
    assert.match(check().join('\n'), /private cross-feature import/);

    source(
      'trainer-athletes',
      'services/relationship.service.ts',
      "import type { UsersRepository } from '#src/modules/users/repositories/users.repository';",
    );
    assert.match(check().join('\n'), /private cross-feature import/);

    source(
      'trainer-athletes',
      'services/relationship.service.ts',
      "import { UsersService } from '#src/modules/users/services/users.service';",
    );
    assert.deepEqual(check(), []);
  });
});

test('Users public-api is stable but direct cross-feature capability policy imports are private', () => {
  fixture(({ module, source, check }) => {
    module('users');
    for (const consumer of ['trainer-athletes', 'training-programs']) {
      module(consumer, "import { UsersModule } from '#src/modules/users/users.module';");
      source(
        consumer,
        'repositories/example.repository.ts',
        "import { deriveAccountCapabilities } from '#src/modules/users/public-api';",
      );
    }

    assert.deepEqual(check(), []);

    for (const consumer of ['trainer-athletes', 'training-programs']) {
      source(
        consumer,
        'repositories/example.repository.ts',
        "import { deriveAccountCapabilities } from '#src/modules/users/policies/account-capabilities.policy';",
      );
      const diagnostics = check().join('\n');
      assert.match(diagnostics, /private cross-feature import/);
      source(
        consumer,
        'repositories/example.repository.ts',
        "import { deriveAccountCapabilities } from '#src/modules/users/public-api';",
      );
    }

    assert.deepEqual(check(), []);
  });
});

test('cross-feature service imports require an explicit Nest module export', () => {
  fixture(({ module, source, check }) => {
    module('first', "import { SecondModule } from '#src/modules/second/second.module';");
    module('second', '@Module({ providers: [SecondService] }) export class SecondModule {}');
    source(
      'first',
      'services/first.service.ts',
      "import { SecondService } from '#src/modules/second/services/second.service';",
    );
    assert.match(check().join(' '), /provider 'SecondService' is not exported by second.module.ts/);

    module(
      'second',
      '@Module({ providers: [SecondService], exports: [SecondService] }) export class SecondModule {}',
    );
    assert.deepEqual(check(), []);
  });
});

test('provider export checks recognize import aliases but ignore type-only imports', () => {
  fixture(({ module, source, check }) => {
    module('first', "import { SecondModule } from '#src/modules/second/second.module';");
    module('second', '@Module({ exports: [OtherService] }) export class SecondModule {}');
    source(
      'first',
      'services/first.service.ts',
      "import { SecondService as Alias } from '#src/modules/second/services/second.service';",
    );
    assert.match(check().join(' '), /provider 'SecondService' is not exported by second.module.ts/);

    source(
      'first',
      'services/first.service.ts',
      "import { type SecondService } from '#src/modules/second/services/second.service';",
    );
    assert.deepEqual(check(), []);
  });
});

test('local constructor-injected feature classes must be registered as providers', () => {
  fixture(({ module, source, check }) => {
    module(
      'first',
      '@Module({ providers: [FirstService, HelperService], controllers: [FirstController], exports: [FirstService] }) export class FirstModule {}',
    );
    source(
      'first',
      'services/first.service.ts',
      '@Injectable() export class FirstService { constructor(private readonly helper: HelperService, private readonly db: PrismaService) {} }',
    );
    source('first', 'services/helper.service.ts', '@Injectable() export class HelperService {}');
    source(
      'first',
      'controllers/first.controller.ts',
      '@Controller() export class FirstController { constructor(private readonly service: FirstService) {} }',
    );
    assert.deepEqual(check(), []);

    module(
      'first',
      '@Module({ providers: [FirstService], controllers: [FirstController], exports: [FirstService] }) export class FirstModule {}',
    );
    assert.match(
      check().join(' '),
      /FirstService injects local HelperService missing from providers/,
    );
  });
});

test('locally declared exported services must also be provided in their Nest module', () => {
  fixture(({ module, source, check }) => {
    module(
      'first',
      '@Module({ providers: [], exports: [FirstService] }) export class FirstModule {}',
    );
    source('first', 'services/first.service.ts', '@Injectable() export class FirstService {}');
    assert.match(check().join(' '), /local export FirstService is missing from providers/);
    module(
      'first',
      '@Module({ providers: [FirstService], exports: [FirstService] }) export class FirstModule {}',
    );
    assert.deepEqual(check(), []);
  });
});

test('local injection guard excludes explicit tokens, optional and nonlocal dependencies', () => {
  fixture(({ module, source, check }) => {
    module('first', '@Module({ providers: [FirstService] }) export class FirstModule {}');
    source(
      'first',
      'services/first.service.ts',
      "@Injectable() export class FirstService { constructor(@Inject('TOKEN') private readonly explicit: TokenService, @Optional() private readonly optional: OptionalService, private readonly external: PrismaService) {} }",
    );
    source('first', 'services/token.service.ts', '@Injectable() export class TokenService {}');
    source(
      'first',
      'services/optional.service.ts',
      '@Injectable() export class OptionalService {}',
    );
    assert.deepEqual(check(), []);
  });
});

test('rejects direct self-injection of a registered Nest provider', () => {
  fixture(({ module, source, check }) => {
    module('first', '@Module({ providers: [FirstService] }) export class FirstModule {}');
    source(
      'first',
      'services/first.service.ts',
      '@Injectable() export class FirstService { constructor(private readonly self: FirstService) {} }',
    );
    assert.match(
      check().join(' '),
      /first\.module\.ts: Nest provider injection cycle: FirstService -> FirstService/,
    );
  });
});

test('rejects two-provider and three-provider local constructor injection cycles', () => {
  fixture(({ module, source, check }) => {
    module(
      'first',
      '@Module({ providers: [FirstService, SecondService, ThirdService] }) export class FirstModule {}',
    );
    source(
      'first',
      'services/first.service.ts',
      '@Injectable() export class FirstService { constructor(private readonly second: SecondService) {} }',
    );
    source(
      'first',
      'services/second.service.ts',
      '@Injectable() export class SecondService { constructor(private readonly first: FirstService) {} }',
    );
    source('first', 'services/third.service.ts', '@Injectable() export class ThirdService {}');

    assert.match(
      check().join(' '),
      /Nest provider injection cycle: FirstService -> SecondService -> FirstService/,
    );

    source(
      'first',
      'services/second.service.ts',
      '@Injectable() export class SecondService { constructor(private readonly third: ThirdService) {} }',
    );
    source(
      'first',
      'services/third.service.ts',
      '@Injectable() export class ThirdService { constructor(private readonly first: FirstService) {} }',
    );
    assert.match(
      check().join(' '),
      /Nest provider injection cycle: FirstService -> SecondService -> ThirdService -> FirstService/,
    );

    source('first', 'services/third.service.ts', '@Injectable() export class ThirdService {}');
    assert.deepEqual(check(), []);
  });
});

test('skips explicit and optional injection edges when detecting provider cycles', () => {
  fixture(({ module, source, check }) => {
    module(
      'first',
      '@Module({ providers: [FirstService, SecondService] }) export class FirstModule {}',
    );
    source(
      'first',
      'services/first.service.ts',
      "@Injectable() export class FirstService { constructor(@Inject('TOKEN') private readonly viaToken: SecondService, @Optional() private readonly maybe: SecondService) {} }",
    );
    source(
      'first',
      'services/second.service.ts',
      '@Injectable() export class SecondService { constructor(private readonly first: FirstService) {} }',
    );
    assert.deepEqual(check(), []);
  });
});

test('rejects runtime provider injection if Nest module dependency is absent', () => {
  fixture(({ module, source, check }) => {
    module('first');
    module('second', '@Module({ exports: [SecondService] }) export class SecondModule {}');
    source(
      'first',
      'services/first.service.ts',
      "import { SecondService } from '#src/modules/second/services/second.service';",
    );
    assert.match(check().join('\n'), /requires its Nest module in first.module.ts/);
  });
});

test('rejects cross-feature relative imports and unknown features', () => {
  fixture(({ module, source, check }) => {
    module('first');
    module('second');
    source(
      'first',
      'services/first.service.ts',
      "import { SecondService } from '../../second/services/second.service.js';\n" +
        "import { Ghost } from '#src/modules/ghost/types/ghost.types';",
    );
    const problems = check().join('\n');
    assert.match(problems, /cross-feature relative import/);
    assert.match(problems, /unknown feature 'ghost'/);
  });
});

test('test files can import cross-feature internals for integration testing', () => {
  fixture(({ module, source, check }) => {
    module('first');
    module('second');
    source(
      'first',
      'test/example.spec.ts',
      "import { OtherController } from '#src/modules/second/controllers/other.controller';",
    );
    assert.deepEqual(check(), []);
  });
});

test('reports missing feature modules without loading application dependencies', () => {
  const root = mkdtempSync(join(tmpdir(), 'gym-feature-deps-empty-'));
  try {
    assert.match(checkFeatureDependencies(root).join('\n'), /feature directory is missing/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a type-only re-export cycle is not a runtime feature cycle', () => {
  fixture(({ module, source, check }) => {
    module('first');
    module('second');
    source(
      'first',
      'types/first.types.ts',
      "export type { Second } from '#src/modules/second/types/second.types';",
    );
    source(
      'second',
      'types/second.types.ts',
      "export { type First } from '#src/modules/first/types/first.types';",
    );
    assert.deepEqual(check(), []);
  });
});

test('runtime re-exports contribute to a feature dependency cycle', () => {
  fixture(({ module, source, check }) => {
    module('first');
    module('second');
    source('first', 'types/index.ts', "export * from '#src/modules/second/types/index';");
    source('second', 'types/index.ts', "export { Runtime } from '#src/modules/first/types/index';");
    assert.match(check().join('\n'), /Runtime feature dependency cycle: first -> second -> first/);
  });
});

test('an import type query does not add a runtime cycle', () => {
  fixture(({ module, source, check }) => {
    module('first');
    module('second');
    source(
      'first',
      'types/first.types.ts',
      "export type Second = import('#src/modules/second/types/second.types').Second;",
    );
    source(
      'second',
      'types/second.types.ts',
      "export type First = typeof import('#src/modules/first/types/first.types').First;",
    );
    assert.deepEqual(check(), []);
  });
});

test('literal dynamic imports cannot bypass private feature boundaries', () => {
  fixture(({ module, source, check }) => {
    module('first');
    module('second');
    source(
      'first',
      'services/first.service.ts',
      "export async function load() { return import('#src/modules/second/controllers/secret.controller'); }",
    );
    assert.match(check().join('\n'), /private cross-feature import/);
  });
});

test('computed imports fail with a path and source line', () => {
  fixture(({ module, source, check }) => {
    module('first');
    source(
      'first',
      'services/first.service.ts',
      "const target = './other.js';\nexport const load = () => import(target);",
    );
    assert.match(
      check().join('\n'),
      /first.service.ts:2: computed dynamic import cannot be checked statically/,
    );
  });
});

test('fake imports inside comments and strings do not add dependencies', () => {
  fixture(({ module, source, check }) => {
    module('first');
    module('second');
    const other = '#src/modules/second/controllers/secret.controller';
    source(
      'first',
      'services/first.service.ts',
      '// import { Secret } from "' +
        other +
        '";\n' +
        'export const note = "export * from ' +
        other +
        '";',
    );
    assert.deepEqual(check(), []);
  });
});

test('allows pilot inner dependencies through aliases and NodeNext relative imports', () => {
  fixture(({ module, source, check }) => {
    module('training-programs');
    source('training-programs', 'domain/model.ts', 'export type Model = string;');
    source('training-programs', 'domain/policy.ts', "import type { Model } from './model.js';");
    source(
      'training-programs',
      'application/ports/publication.ts',
      "export type { Model } from '#src/modules/training-programs/domain/model';",
    );
    source(
      'training-programs',
      'application/publish.ts',
      "import type { Model } from './ports/publication.js';",
    );
    assert.deepEqual(check(), []);
  });
});

test.each([
  ['mts', 'mjs'],
  ['cts', 'cjs'],
  ['d.mts', 'mjs'],
  ['d.cts', 'cjs'],
])('resolves .%s files through relative .%s imports', (sourceExtension, outputExtension) => {
  fixture(({ module, source, check }) => {
    module('training-programs');
    source('training-programs', `domain/model.${sourceExtension}`, 'export type Model = string;');
    source(
      'training-programs',
      'application/publish.ts',
      `import type { Model } from '../domain/model.${outputExtension}';`,
    );
    assert.deepEqual(check(), []);
  });
});

test.each([
  ['mts', 'mjs'],
  ['cts', 'cjs'],
])('rejects outward .%s imports through relative .%s paths', (sourceExtension, outputExtension) => {
  fixture(({ module, source, check }) => {
    module('training-programs');
    source(
      'training-programs',
      `application/port.${sourceExtension}`,
      'export type Port = string;',
    );
    source(
      'training-programs',
      `domain/policy.${sourceExtension}`,
      `import type { Port } from '../application/port.${outputExtension}';`,
    );
    assert.deepEqual(check(), [
      `src/modules/training-programs/domain/policy.${sourceExtension}: clean architecture domain import '../application/port.${outputExtension}' must resolve within its allowed inner layers`,
    ]);
  });
});

test('rejects mismatched NodeNext relative extensions', () => {
  fixture(({ module, source, check }) => {
    module('training-programs');
    source('training-programs', 'domain/model.cts', 'export type Model = string;');
    source('training-programs', 'domain/model.mjs.ts', 'export type Model = string;');
    source('training-programs', 'domain/policy.ts', "import type { Model } from './model.mjs';");
    assert.match(check().join('\n'), /clean architecture domain import '\.\/model\.mjs'/);
  });
});

test.each([
  ['domain', "import { Injectable } from '@nestjs/common';"],
  ['domain', "import type { Prisma } from '#prisma/client';"],
  ['domain', "import type { Port } from '../application/port.js';"],
  ['domain', "import type { Port } from '#src/modules/training-programs/application/port';"],
  ['domain', "export * from '../repositories/adapter.js';"],
  ['domain', "import { Dto } from '../dto/input.js';"],
  ['domain', "import { Adapter } from '#src/infra/database/index';"],
  ['domain', "import { readFile } from 'node:fs';"],
  ['domain', "import { x } from '@gym/domain';"],
  ['domain', "import { x } from './missing.js';"],
  ['domain', "import type { X } from '#src/modules/training-programs/domain/../dto/input';"],
  ['application', "import { Injectable } from '@nestjs/common';"],
  ['application', "type Client = import('#prisma/client').PrismaClient;"],
  ['application', "import type { X } from '../types/payload.js';"],
  ['application', "import { Adapter } from '../repositories/adapter.js';"],
  ['application', "import { Service } from '../services/service.js';"],
  ['application', "import { Controller } from '../controllers/controller.js';"],
  ['application', "import { Adapter } from '../infrastructure/adapter.js';"],
  ['application', "import { Dto } from '../presentation/dto.js';"],
  ['application', "import { x } from '#src/modules/workouts/public-api';"],
])('rejects outward or unresolved %s imports: %s', (layer, statement) => {
  fixture(({ module, source, check }) => {
    module('training-programs');
    module('workouts');
    source('workouts', 'public-api.ts', 'export const x = 1;');
    for (const target of [
      'application/port.ts',
      'repositories/adapter.ts',
      'dto/input.ts',
      'types/payload.ts',
      'services/service.ts',
      'controllers/controller.ts',
      'infrastructure/adapter.ts',
      'presentation/dto.ts',
    ]) {
      source('training-programs', target, 'export {};');
    }
    source('training-programs', layer + '/example.ts', statement);
    assert.match(check().join('\n'), new RegExp('clean architecture ' + layer + ' import'));
  });
});

test('rejects computed imports and requires in opted-in layers', () => {
  fixture(({ module, source, check }) => {
    module('training-programs');
    source(
      'training-programs',
      'domain/policy.ts',
      'const a = import(name); const b = require(name);',
    );
    const errors = check().join('\n');
    assert.match(errors, /computed dynamic import cannot be checked statically/);
    assert.match(errors, /computed require cannot be checked statically/);
  });
});

test('rejects cycles across type-only, alias and barrel edges in migrated code', () => {
  fixture(({ module, source, check }) => {
    module('training-programs');
    source('training-programs', 'domain/model.ts', "import type { T } from './index.js';");
    source(
      'training-programs',
      'domain/index.ts',
      "export type { T } from '#src/modules/training-programs/domain/model';",
    );
    assert.match(
      check().join('\n'),
      /clean architecture file dependency cycle: domain\/index.ts -> domain\/model.ts -> domain\/index.ts/,
    );
    source('training-programs', 'domain/model.ts', 'export type T = string;');
    assert.deepEqual(check(), []);
    source('training-programs', 'application/self.ts', "import type { T } from './self.js';");
    assert.match(
      check().join('\n'),
      /clean architecture file dependency cycle: application\/self.ts -> application\/self.ts/,
    );
  });
});

test('rejects cycles through .ts, .mts and .cts files', () => {
  fixture(({ module, source, check }) => {
    module('training-programs');
    source(
      'training-programs',
      'domain/a.ts',
      "import type { B } from './b.mjs'; export type A = B;",
    );
    source(
      'training-programs',
      'domain/b.mts',
      "import type { C } from './c.cjs'; export type B = C;",
    );
    source(
      'training-programs',
      'domain/c.cts',
      `import type { A } from './a.js' with { 'resolution-mode': 'import' }; export type C = { model: A };`,
    );
    assert.match(
      check().join('\n'),
      /clean architecture file dependency cycle: domain\/a.ts -> domain\/b.mts -> domain\/c.cts -> domain\/a.ts/,
    );
  });
});

test('keeps legacy and non-opted-in feature paths outside the new inward rules', () => {
  fixture(({ module, source, check }) => {
    module('training-programs');
    module('workouts');
    source(
      'training-programs',
      'services/legacy.service.ts',
      "import { Injectable } from '@nestjs/common';",
    );
    source(
      'training-programs',
      'policies/legacy.policy.ts',
      "import type { Prisma } from '#prisma/client';",
    );
    module('other');
    source('other', 'domain/legacy.ts', "import { Injectable } from '@nestjs/common';");
    source(
      'workouts',
      'services/legacy.service.ts',
      "import { Injectable } from '@nestjs/common';",
    );
    source('training-programs', 'domain/policy.ts', 'export const rule = true;');
    source(
      'training-programs',
      'repositories/adapter.ts',
      "import { rule } from '../domain/policy.js';",
    );
    assert.deepEqual(check(), []);
  });
});

test('allows inward Workouts imports without migrating legacy services', () => {
  fixture(({ module, source, check }) => {
    module('workouts');
    source('workouts', 'domain/model.ts', 'export type Model = string;');
    source(
      'workouts',
      'application/complete.ts',
      "import type { Model } from '#src/modules/workouts/domain/model';",
    );
    source(
      'workouts',
      'services/workouts.service.ts',
      "import { Injectable } from '@nestjs/common';",
    );
    assert.deepEqual(check(), []);
  });
});

test.each([
  ['domain', "import type { Prisma } from '#prisma/client';"],
  ['domain', "import { x } from '@gym/domain';"],
  ['domain', "import type { X } from '../application/port.js';"],
  ['application', "import { Injectable } from '@nestjs/common';"],
  ['application', "export * from '../repositories/adapter.js';"],
])('rejects outward Workouts %s imports: %s', (layer, statement) => {
  fixture(({ module, source, check }) => {
    module('workouts');
    source('workouts', 'application/port.ts', 'export type X = string;');
    source('workouts', 'repositories/adapter.ts', 'export {};');
    source('workouts', layer + '/example.ts', statement);
    assert.match(check().join('\n'), new RegExp('clean architecture ' + layer + ' import'));
  });
});

test('rejects type-only cycles inside Workouts application', () => {
  fixture(({ module, source, check }) => {
    module('workouts');
    source('workouts', 'application/a.ts', "import type { B } from './b.js';");
    source('workouts', 'application/b.ts', "import type { A } from './a.js';");
    assert.match(check().join('\n'), /workouts: clean architecture file dependency cycle/);
  });
});

test('allows inward Trainer–Athletes dependencies without migrating legacy services', () => {
  fixture(({ module, source, check }) => {
    module('trainer-athletes');
    source('trainer-athletes', 'domain/lifecycle.ts', 'export type Status = string;');
    source(
      'trainer-athletes',
      'application/terminate.ts',
      "import type { Status } from '#src/modules/trainer-athletes/domain/lifecycle';",
    );
    source(
      'trainer-athletes',
      'services/termination.service.ts',
      "import { Injectable } from '@nestjs/common';",
    );
    assert.deepEqual(check(), []);
  });
});

test.each([
  ['domain', "import type { Prisma } from '#prisma/client';"],
  ['domain', "import type { X } from '../application/port.js';"],
  ['application', "import { Injectable } from '@nestjs/common';"],
  ['application', "export * from '../repositories/adapter.js';"],
  ['application', "import type { X } from '#src/modules/users/public-api';"],
])('rejects outward Trainer–Athletes %s imports: %s', (layer, statement) => {
  fixture(({ module, source, check }) => {
    module('trainer-athletes');
    module('users');
    source('users', 'public-api.ts', 'export type X = string;');
    source('trainer-athletes', 'application/port.ts', 'export type X = string;');
    source('trainer-athletes', 'repositories/adapter.ts', 'export {};');
    source('trainer-athletes', layer + '/example.ts', statement);
    assert.match(check().join('\n'), new RegExp('clean architecture ' + layer + ' import'));
  });
});

test('rejects type-only cycles inside Trainer–Athletes application', () => {
  fixture(({ module, source, check }) => {
    module('trainer-athletes');
    source('trainer-athletes', 'application/a.ts', "import type { B } from './b.js';");
    source('trainer-athletes', 'application/b.ts', "import type { A } from './a.js';");
    assert.match(check().join('\n'), /trainer-athletes: clean architecture file dependency cycle/);
  });
});
