import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

import { parseModuleImports } from './import-parser.mjs';

function filesUnder(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? filesUnder(path) : entry.isFile() ? [path] : [];
    })
    .sort();
}

function isOutside(directory, target) {
  const path = relative(directory, target);
  return path === '..' || path.startsWith('..' + sep) || isAbsolute(path);
}

const apiAudiences = new Set(['public', 'shared', 'athlete', 'trainer', 'admin']);

function registeredControllers(source, file) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const names = [];
  const bindings = new Map();
  let literal = true;

  for (const declaration of ast.statements) {
    if (ts.isImportDeclaration(declaration)) {
      const clause = declaration.importClause;
      const named = clause?.namedBindings;
      if (
        !clause?.isTypeOnly &&
        named &&
        ts.isNamedImports(named) &&
        ts.isStringLiteralLike(declaration.moduleSpecifier)
      ) {
        for (const binding of named.elements) {
          if (!binding.isTypeOnly) {
            bindings.set(binding.name.text, {
              name: binding.propertyName?.text ?? binding.name.text,
              path: declaration.moduleSpecifier.text,
            });
          }
        }
      }
    }
    if (!ts.isClassDeclaration(declaration)) continue;
    for (const decorator of ts.getDecorators(declaration) ?? []) {
      const call = decorator.expression;
      if (
        !ts.isCallExpression(call) ||
        !ts.isIdentifier(call.expression) ||
        call.expression.text !== 'Module'
      ) {
        continue;
      }
      const options = call.arguments[0];
      if (!options || !ts.isObjectLiteralExpression(options)) {
        literal = false;
        continue;
      }
      for (const property of options.properties) {
        if (ts.isSpreadAssignment(property)) literal = false;
        if (!property.name || property.name.getText(ast).replace(/['"]/g, '') !== 'controllers') {
          continue;
        }
        if (
          !ts.isPropertyAssignment(property) ||
          !ts.isArrayLiteralExpression(property.initializer)
        ) {
          literal = false;
          continue;
        }
        for (const item of property.initializer.elements) {
          if (ts.isIdentifier(item)) names.push(item.text);
          else literal = false;
        }
      }
    }
  }
  return { names, bindings, literal };
}

function controllerImportTarget(sourceRoot, file, specifier) {
  let target;
  if (specifier.startsWith('#src/')) target = resolve(sourceRoot, specifier.slice(5));
  else if (specifier.startsWith('./') || specifier.startsWith('../')) {
    target = resolve(dirname(file), specifier);
  }
  if (!target) return null;
  if (target.endsWith('.js')) return target.replace(/\.js$/, '.ts');
  return target.endsWith('.ts') ? target : target + '.ts';
}

// A feature opts in only with a nonempty, reviewed audience declaration and
// real controllers. Keep the legacy checks for every controller still in place.
function checkApiControllerOwnership(root, modules, errors) {
  const sourceRoot = join(root, 'src');
  const apiRoot = join(sourceRoot, 'api');
  const display = (file) => relative(root, file).split(sep).join('/');
  const declared = new Map();
  const moved = new Map();
  const owners = new Map();

  for (const feature of modules) {
    const manifest = join(sourceRoot, 'modules', feature, 'api-interfaces.json');
    if (!existsSync(manifest)) continue;
    try {
      const value = JSON.parse(readFileSync(manifest, 'utf8'));
      const audiences = value?.audiences;
      if (
        !Array.isArray(audiences) ||
        !audiences.length ||
        audiences.some((audience) => !apiAudiences.has(audience)) ||
        new Set(audiences).size !== audiences.length
      ) {
        throw new Error('expected nonempty unique audiences');
      }
      declared.set(feature, audiences);
    } catch {
      errors.push(display(manifest) + ': invalid API interface ownership declaration');
    }
  }

  const apiFiles = filesUnder(apiRoot);
  if (apiFiles.length === 0 && declared.size === 0) return new Set();

  for (const file of apiFiles.filter((path) => path.endsWith('.controller.ts'))) {
    const [audience, feature, folder, filename, ...extra] = relative(apiRoot, file).split(sep);
    if (
      !apiAudiences.has(audience) ||
      !modules.includes(feature) ||
      folder !== 'controllers' ||
      !filename ||
      extra.length
    ) {
      errors.push(
        display(file) + ': expected api/<audience>/<feature>/controllers/*.controller.ts',
      );
      continue;
    }
    if (!declared.get(feature)?.includes(audience)) {
      errors.push(display(file) + ': missing feature API interface ownership declaration');
    }
    const leaf = join(apiRoot, audience, feature);
    const owner = join(leaf, audience + '-' + feature + '-api.module.ts');
    const className = readFileSync(file, 'utf8').match(/\bexport\s+class\s+(\w+Controller)\b/)?.[1];
    if (!className) {
      errors.push(display(file) + ': missing exported controller class');
      continue;
    }
    const controllers = owners.get(owner) ?? [];
    controllers.push({ file, className });
    owners.set(owner, controllers);
    const audiences = moved.get(feature) ?? new Set();
    audiences.add(audience);
    moved.set(feature, audiences);

    const spec = join(leaf, 'test', 'controllers', filename.replace(/\.ts$/, '.spec.ts'));
    if (!existsSync(spec)) errors.push(display(spec) + ': missing controller unit test');
    const registry = join(leaf, 'test', 'controllers');
    if (
      !filesUnder(registry).some(
        (path) => dirname(path) === registry && path.endsWith('controller-registry.spec.ts'),
      )
    ) {
      errors.push(display(leaf) + ': expected test/controllers/*controller-registry.spec.ts');
    }
  }

  for (const [feature, audiences] of declared) {
    for (const audience of audiences) {
      if (!moved.get(feature)?.has(audience)) {
        errors.push(feature + ': declared API audience ' + audience + ' has no controller');
      }
    }
  }

  // Check literal registrations across source modules, including AppModule,
  // so moving a controller cannot leave a second explicit registration behind.
  const registrations = new Map();
  const allModules = filesUnder(sourceRoot).filter(
    (file) =>
      file.endsWith('.module.ts') &&
      !relative(sourceRoot, file).split(sep).some((part) => ['test', 'generated'].includes(part)),
  );
  for (const file of allModules) {
    const metadata = registeredControllers(readFileSync(file, 'utf8'), file);
    registrations.set(file, metadata);
    if (isOutside(apiRoot, file)) continue;
    const expected = owners.get(file) ?? [];
    if (!metadata.literal) {
      errors.push(display(file) + ': API controller registration must be a literal array');
    }
    for (const name of metadata.names) {
      if (!expected.some((controller) => controller.className === name)) {
        errors.push(display(file) + ": unrecognized registered API controller '" + name + "'");
      }
    }
  }

  for (const [owner, controllers] of owners) {
    const metadata = registrations.get(owner);
    if (!metadata) {
      errors.push(display(owner) + ': missing owning API module');
      continue;
    }
    for (const { file, className } of controllers) {
      const expectedImport = './controllers/' + basename(file).replace(/\.ts$/, '.js');
      const binding = metadata.bindings.get(className);
      if (binding?.path !== expectedImport || binding.name !== className) {
        errors.push(display(owner) + ": import controller directly from '" + expectedImport + "'");
      }
      if (metadata.names.filter((name) => name === className).length !== 1) {
        errors.push(display(owner) + ': ' + className + ' must be registered exactly once');
      }
      for (const [other, registration] of registrations) {
        if (other === owner) continue;
        for (const name of registration.names) {
          const imported = registration.bindings.get(name);
          if (
            name === className ||
            (imported?.name === className &&
              controllerImportTarget(sourceRoot, other, imported.path) === file)
          ) {
            errors.push(display(other) + ': duplicate API controller registration ' + className);
          }
        }
      }
    }
  }

  for (const file of apiFiles.filter((path) => path.endsWith('.controller.spec.ts'))) {
    const [audience, feature, test, folder, filename, ...extra] = relative(apiRoot, file).split(
      sep,
    );
    if (
      test !== 'test' ||
      folder !== 'controllers' ||
      !filename ||
      extra.length ||
      !existsSync(
        join(apiRoot, audience, feature, 'controllers', filename.replace(/\.spec\.ts$/, '.ts')),
      )
    ) {
      errors.push(display(file) + ': no matching API controller in controllers/');
    }
  }

  return new Set(
    [...declared]
      .filter(([feature, audiences]) =>
        audiences.every((audience) => moved.get(feature)?.has(audience)),
      )
      .map(([feature]) => feature),
  );
}

/**
 * Non-mutating guard for structural conventions in src/modules and src/api.
 * Returns actionable diagnostics, allowing isolated filesystem fixtures in tests.
 */
export function checkArchitecture(repositoryRoot) {
  const root = resolve(repositoryRoot);
  const modulesRoot = join(root, 'src', 'modules');
  const errors = [];

  if (!existsSync(modulesRoot)) {
    return ['src/modules: feature module directory is missing'];
  }

  const modules = readdirSync(modulesRoot, { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => item.name)
    .filter((name) => existsSync(join(modulesRoot, name, `${name}.module.ts`)))
    .sort();

  if (modules.length === 0) {
    return ['src/modules: no feature modules found'];
  }

  const migrated = checkApiControllerOwnership(root, modules, errors);

  for (const name of modules) {
    const directory = join(modulesRoot, name);
    const moduleFile = join(directory, `${name}.module.ts`);
    const controllerDir = join(directory, 'controllers');
    const testDir = join(directory, 'test', 'controllers');
    const moduleSource = readFileSync(moduleFile, 'utf8');
    const featureFiles = filesUnder(directory);
    // Helper files and index barrels are legitimate members of domain layers.
    const domainLayers = ['services', 'repositories', 'selects', 'types'];
    const domainFiles = domainLayers.flatMap((layer) =>
      filesUnder(join(directory, layer)).filter(
        (file) => dirname(file) === join(directory, layer) && file.endsWith('.ts'),
      ),
    );
    const controllers = filesUnder(controllerDir).filter(
      (path) => dirname(path) === controllerDir && path.endsWith('.controller.ts'),
    );
    const controllerNames = new Set(controllers.map((path) => basename(path)));
    const testFiles = filesUnder(testDir).filter(
      (path) => dirname(path) === testDir && path.endsWith('.spec.ts'),
    );

    const display = (file) => relative(root, file).split('\\').join('/');

    // Enforce role suffix locations at the feature root and in managed
    // domain directories only; nested subfeatures such as users/avatar/
    // deliberately manage their own implementation layout.
    const roleFolders = [
      ['.service.ts', 'services'],
      ['.repository.ts', 'repositories'],
      ['.select.ts', 'selects'],
      ['.types.ts', 'types'],
    ];
    for (const file of featureFiles) {
      const parent = dirname(file);
      if (parent !== directory && !domainLayers.some((layer) => parent === join(directory, layer)))
        continue;

      for (const [suffix, folder] of roleFolders) {
        if (basename(file).endsWith(suffix) && parent !== join(directory, folder)) {
          errors.push(`${display(file)}: ${suffix} file must live in ${folder}/`);
        }
      }
    }

    if (controllers.length === 0 && !migrated.has(name)) {
      errors.push(`${name}: expected controllers/*.controller.ts`);
    }

    for (const file of featureFiles) {
      if (file.endsWith('.controller.ts') && !controllerNames.has(basename(file))) {
        // Check the absolute directory too: files with equal names in a
        // different directory must still be reported.
        if (dirname(file) !== controllerDir) {
          errors.push(`${display(file)}: controller must live directly in controllers/`);
        }
      } else if (file.endsWith('.controller.ts') && dirname(file) !== controllerDir) {
        errors.push(`${display(file)}: controller must live directly in controllers/`);
      }
    }

    const registered = moduleSource.match(/\bcontrollers\s*:\s*\[([\s\S]*?)\]/);
    if (!registered) {
      errors.push(`${display(moduleFile)}: missing @Module controllers array`);
    }

    const registeredNames = registered
      ? registered[1]
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      : [];

    if (new Set(registeredNames).size !== registeredNames.length) {
      errors.push(`${display(moduleFile)}: duplicate controller registrations`);
    }

    for (const controller of controllers) {
      const filename = basename(controller);
      const source = readFileSync(controller, 'utf8');
      const className = source.match(/\bexport\s+class\s+(\w+Controller)\b/)?.[1];
      const expectedImport = `./controllers/${filename.replace(/\.ts$/, '.js')}`;
      const expectedSpec = join(testDir, filename.replace(/\.ts$/, '.spec.ts'));

      if (!className) {
        errors.push(`${display(controller)}: missing exported controller class`);
      } else if (!registeredNames.includes(className)) {
        errors.push(`${display(moduleFile)}: ${className} not registered`);
      }

      if (
        !parseModuleImports(moduleSource, moduleFile).some(
          (entry) => entry.path === expectedImport && !entry.typeOnly,
        )
      ) {
        errors.push(`${display(moduleFile)}: import controller directly from '${expectedImport}'`);
      }

      if (!existsSync(expectedSpec)) {
        errors.push(`${display(expectedSpec)}: missing controller unit test`);
      }
    }

    for (const className of registeredNames) {
      const found = controllers.some((path) => {
        const source = readFileSync(path, 'utf8');
        return source.match(/\bexport\s+class\s+(\w+Controller)\b/)?.[1] === className;
      });
      if (!found) {
        errors.push(`${display(moduleFile)}: unrecognized registered controller '${className}'`);
      }
    }

    if (
      (controllers.length > 0 || !migrated.has(name)) &&
      !testFiles.some((path) => basename(path).endsWith('controller-registry.spec.ts'))
    ) {
      errors.push(`${name}: expected test/controllers/*controller-registry.spec.ts`);
    }

    for (const testFile of testFiles.filter((path) => path.endsWith('.controller.spec.ts'))) {
      const expectedController = basename(testFile).replace(/\.spec\.ts$/, '.ts');
      if (!controllerNames.has(expectedController)) {
        errors.push(`${display(testFile)}: no matching controller in controllers/`);
      }
    }

    // Validate imports in domain layers as well as HTTP/controller boundaries.
    for (const file of [moduleFile, ...controllers, ...testFiles, ...domainFiles]) {
      const sourceLayer = domainLayers.find((layer) => dirname(file) === join(directory, layer));
      for (const imported of parseModuleImports(readFileSync(file, 'utf8'), file)) {
        if (imported.path === null) {
          errors.push(
            `${display(file)}:${imported.line}: computed dynamic import cannot be checked statically; use a string literal`,
          );
          continue;
        }
        const specifier = imported.path;
        if (specifier.startsWith('@src/') || specifier.startsWith('@prisma/')) {
          errors.push(`${display(file)}: use native #src/#prisma instead of '${specifier}'`);
        } else if (specifier.startsWith('#src/') || specifier.startsWith('#prisma/')) {
          if (specifier.endsWith('.js') || specifier.endsWith('.ts')) {
            errors.push(`${display(file)}: native alias must omit .js/.ts: '${specifier}'`);
          }
        } else if (specifier.startsWith('./') || specifier.startsWith('../')) {
          if (!specifier.endsWith('.js')) {
            errors.push(`${display(file)}: relative ESM import needs .js: '${specifier}'`);
          }
          if (isOutside(directory, resolve(dirname(file), specifier))) {
            errors.push(
              `${display(file)}: cross-feature relative import '${specifier}'; use #src/*`,
            );
          }
        }

        if (sourceLayer) {
          let targetLayer;
          if (specifier.startsWith('./') || specifier.startsWith('../')) {
            const target = resolve(dirname(file), specifier);
            if (!isOutside(directory, target)) {
              targetLayer = relative(directory, target).split(sep)[0];
            }
          } else {
            const sameFeatureAlias = `#src/modules/${name}/`;
            if (specifier.startsWith(sameFeatureAlias)) {
              targetLayer = specifier.slice(sameFeatureAlias.length).split('/')[0];
            }
          }

          const forbidden =
            targetLayer === 'controllers' ||
            (sourceLayer !== 'services' && targetLayer === 'services');
          if (forbidden) {
            errors.push(
              `${display(file)}: ${sourceLayer}/ must not import ${targetLayer}/: '${specifier}'`,
            );
          }
        }
      }
    }
  }

  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = checkArchitecture(process.cwd());
  if (problems.length > 0) {
    console.error('Feature architecture violations:\n' + problems.map((p) => ` - ${p}`).join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Feature architecture conventions: OK');
  }
}
