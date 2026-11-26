import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseClassConstructorDependencies,
  parseModuleImports,
  parseNestModuleMetadata,
} from './import-parser.mjs';

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? walk(path) : entry.isFile() ? [path] : [];
    })
    .sort();
}

function outside(directory, target) {
  const path = relative(directory, target);
  return path === '..' || path.startsWith('..' + sep) || isAbsolute(path);
}

function addEdge(graph, from, to) {
  if (from !== to) graph.get(from).add(to);
}

function firstCycle(graph) {
  const visited = new Set();
  const active = new Set();
  const stack = [];

  const visit = (node) => {
    visited.add(node);
    active.add(node);
    stack.push(node);
    for (const target of [...graph.get(node)].sort()) {
      if (active.has(target)) {
        return [...stack.slice(stack.indexOf(target)), target];
      }
      if (!visited.has(target)) {
        const found = visit(target);
        if (found) return found;
      }
    }
    active.delete(node);
    stack.pop();
    return null;
  };

  for (const node of [...graph.keys()].sort()) {
    if (!visited.has(node)) {
      const found = visit(node);
      if (found) return found;
    }
  }
  return null;
}

// Opt in per feature after review; legacy folders are deliberately not migrated.
const cleanArchitectureFeatures = new Set(['training-programs', 'workouts', 'trainer-athletes']);

function cleanLayer(featureRoot, file) {
  if (outside(featureRoot, file)) return null;
  const [layer] = relative(featureRoot, file).split(sep);
  return layer === 'domain' || layer === 'application' ? layer : null;
}

function resolveCleanImport(sourceRoot, file, specifier, files) {
  let target;
  if (specifier.startsWith('#src/')) {
    target = resolve(sourceRoot, specifier.slice('#src/'.length));
  } else if (specifier.startsWith('./') || specifier.startsWith('../')) {
    target = resolve(dirname(file), specifier);
    const extension = extname(specifier);
    if (extension === '.mjs' || extension === '.cjs') {
      const base = target.slice(0, -extension.length);
      const sourceExtension = extension.replace('js', 'ts');
      const candidates = [base + sourceExtension, base + '.d' + sourceExtension];
      return candidates.find((candidate) => files.has(candidate)) ?? null;
    }
  } else {
    return null;
  }

  // Match NodeNext source conventions, including extensionless #src aliases.
  const candidates = [
    target,
    target.replace(/\.js$/, '.ts'),
    target + '.ts',
    join(target, 'index.ts'),
  ];
  return candidates.find((candidate) => files.has(candidate)) ?? null;
}

function checkCleanImport(sourceRoot, featureRoot, file, imported, files, graph, errors) {
  const layer = cleanLayer(featureRoot, file);
  if (!layer) return;

  const target = resolveCleanImport(sourceRoot, file, imported.path, files);
  const targetLayer = target && cleanLayer(featureRoot, target);
  const allowed =
    targetLayer === 'domain' || (layer === 'application' && targetLayer === 'application');
  if (!allowed) {
    const display = relative(sourceRoot, file).split(sep).join('/');
    errors.push(
      'src/' +
        display +
        ': clean architecture ' +
        layer +
        " import '" +
        imported.path +
        "' must resolve within its allowed inner layers",
    );
    return;
  }

  // Include type-only edges and self-imports in the migrated file graph.
  graph.get(file).add(target);
}

// ADR-010: audience adapters depend inward on explicitly public feature
// contracts. This first guard is source-level only; Nest registration and
// provider visibility are checked separately during the composition pilot.
const apiAudiences = new Set(['public', 'shared', 'athlete', 'trainer', 'admin']);

function sourceImportTarget(sourceRoot, file, specifier) {
  if (specifier.startsWith('#src/')) return resolve(sourceRoot, specifier.slice(5));
  if (specifier.startsWith('#prisma/')) {
    return resolve(sourceRoot, 'infra/database/generated/prisma', specifier.slice(8));
  }
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    return resolve(dirname(file), specifier);
  }
  return null;
}

function checkApiInterfaceImports(sourceRoot, known) {
  const apiRoot = join(sourceRoot, 'api');
  const errors = [];

  for (const file of walk(sourceRoot)) {
    const parts = relative(sourceRoot, file).split(sep);
    if (
      !/\.[mc]?ts$/.test(file) ||
      parts.includes('test') ||
      /\.(?:spec|test)\.[mc]?ts$/.test(file) ||
      parts.includes('generated')
    )
      continue;

    const inApi = parts[0] === 'api';
    const audience = inApi && apiAudiences.has(parts[1]) ? parts[1] : null;
    const inward = ['modules', 'common', 'infra'].includes(parts[0]);
    if (!inApi && !inward) continue;

    const display = 'src/' + parts.join('/');
    if (inApi && !audience && !(parts.length === 2 && file.endsWith('.module.ts'))) {
      errors.push(
        display + ': API interface must belong to an audience or root composition module',
      );
    }

    for (const imported of parseModuleImports(readFileSync(file, 'utf8'), file, {
      checkComputedRequire: inApi,
    })) {
      const fail = (reason) => errors.push(display + ': ' + reason + " '" + imported.path + "'");
      if (imported.path === null) {
        if (inApi) errors.push(display + ': computed import/require cannot be checked statically');
        continue;
      }
      const target = sourceImportTarget(sourceRoot, file, imported.path);
      if (target && !outside(apiRoot, target)) {
        if (inward) fail('inward layer cannot import API interface');
        if (audience && relative(apiRoot, target).split(sep)[0] !== audience) {
          fail('audience cannot import another API interface or root composition');
        }
      }
      if (!inApi) continue;

      if (
        imported.path === '@prisma/client' ||
        imported.path.startsWith('@prisma/') ||
        imported.path === 'prisma' ||
        imported.path.startsWith('#prisma/') ||
        (target && !outside(join(sourceRoot, 'infra', 'database'), target))
      ) {
        fail('API interface cannot import persistence directly');
      }

      if (target && !outside(join(sourceRoot, 'modules'), target)) {
        const [feature, ...rest] = relative(join(sourceRoot, 'modules'), target).split(sep);
        const contract = rest.join('/').replace(/\.[mc]?[jt]s$/, '');
        if (!known.has(feature) || ![feature + '.module', 'public-api'].includes(contract)) {
          fail('API interface must use an explicit feature module or public-api contract');
        }
      }
    }
  }
  return errors;
}

/**
 * Checks the source-level runtime dependency graph separately from type-only
 * references; checks Nest module imports and direct cross-feature boundaries.
 * No project compilation, Prisma, database or runtime imports are necessary.
 */
export function checkFeatureDependencies(repositoryRoot) {
  const sourceRoot = join(resolve(repositoryRoot), 'src');
  const modulesRoot = join(sourceRoot, 'modules');
  if (!existsSync(modulesRoot)) return ['src/modules: feature directory is missing'];

  const modules = readdirSync(modulesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(join(modulesRoot, name, name + '.module.ts')))
    .sort();
  if (modules.length === 0) return ['src/modules: no feature modules found'];

  const known = new Set(modules);
  const runtime = new Map(modules.map((name) => [name, new Set()]));
  const nestModules = new Map(modules.map((name) => [name, new Set()]));
  const moduleSources = new Map(
    modules.map((name) => [
      name,
      readFileSync(join(modulesRoot, name, name + '.module.ts'), 'utf8'),
    ]),
  );
  const moduleMetadata = new Map(
    modules.map((name) => [name, parseNestModuleMetadata(moduleSources.get(name))]),
  );
  const errors = checkApiInterfaceImports(sourceRoot, known);

  for (const name of modules) {
    const files = walk(join(modulesRoot, name)).filter(
      (file) =>
        /\.[mc]?ts$/.test(file) &&
        !relative(join(modulesRoot, name), file).split(sep).includes('test'),
    );
    const featureRoot = join(modulesRoot, name);
    const cleanFiles = new Set(
      cleanArchitectureFeatures.has(name)
        ? files.filter((file) => cleanLayer(featureRoot, file))
        : [],
    );
    const cleanGraph = new Map([...cleanFiles].map((file) => [file, new Set()]));
    const registration = moduleMetadata.get(name);
    const localClasses = new Map();
    for (const file of files) {
      for (const declaration of parseClassConstructorDependencies(
        readFileSync(file, 'utf8'),
        file,
      )) {
        localClasses.set(declaration.name, declaration.dependencies);
      }
    }

    for (const exported of registration.exports) {
      if (localClasses.has(exported) && !registration.providers.has(exported)) {
        errors.push(name + '.module.ts: local export ' + exported + ' is missing from providers');
      }
    }

    for (const registered of [...registration.providers, ...registration.controllers]) {
      for (const dependency of localClasses.get(registered) ?? []) {
        if (localClasses.has(dependency) && !registration.providers.has(dependency)) {
          errors.push(
            name +
              '.module.ts: ' +
              registered +
              ' injects local ' +
              dependency +
              ' missing from providers',
          );
        }
      }
    }

    // Only actual class providers participate in Nest constructor injection.
    // Keep self-edges here: a provider injecting itself is a DI cycle too.
    const providerGraph = new Map(
      [...registration.providers]
        .filter((provider) => localClasses.has(provider))
        .map((provider) => [provider, new Set()]),
    );
    for (const [provider, dependencies] of providerGraph) {
      for (const dependency of localClasses.get(provider)) {
        if (providerGraph.has(dependency)) dependencies.add(dependency);
      }
    }
    const providerCycle = firstCycle(providerGraph);
    if (providerCycle) {
      errors.push(
        name + '.module.ts: Nest provider injection cycle: ' + providerCycle.join(' -> '),
      );
    }

    for (const file of files) {
      const display = relative(resolve(repositoryRoot), file).split(sep).join('/');
      const imports = parseModuleImports(readFileSync(file, 'utf8'), file, {
        checkComputedRequire: cleanFiles.has(file),
      });
      for (const imported of imports) {
        if (imported.path === null) {
          errors.push(
            display +
              ':' +
              imported.line +
              (imported.kind === 'require-unresolved'
                ? ': computed require cannot be checked statically; use a string literal'
                : ': computed dynamic import cannot be checked statically; use a string literal'),
          );
          continue;
        }
        if (cleanFiles.has(file)) {
          checkCleanImport(sourceRoot, featureRoot, file, imported, cleanFiles, cleanGraph, errors);
        }
        let targetFeature;
        let targetPath;
        let relativeCrossFeature = false;

        const alias = /^#src\/modules\/([^/]+)\/(.+)$/.exec(imported.path);
        if (alias) {
          targetFeature = alias[1];
          targetPath = alias[2];
        } else if (imported.path.startsWith('./') || imported.path.startsWith('../')) {
          const target = resolve(dirname(file), imported.path);
          if (!outside(modulesRoot, target)) {
            const parts = relative(modulesRoot, target).split(sep);
            if (parts[0] !== name) {
              targetFeature = parts[0];
              relativeCrossFeature = true;
            }
          }
        }

        if (!targetFeature || targetFeature === name) continue;

        if (relativeCrossFeature) {
          errors.push(
            display +
              ": cross-feature relative import '" +
              imported.path +
              "'; use #src/modules/<feature>/...",
          );
        }

        if (!known.has(targetFeature)) {
          errors.push(
            display + ": unknown feature '" + targetFeature + "' in import '" + imported.path + "'",
          );
          continue;
        }

        if (!imported.typeOnly) {
          addEdge(runtime, name, targetFeature);
          if (
            file === join(modulesRoot, name, name + '.module.ts') &&
            targetPath === targetFeature + '.module'
          ) {
            addEdge(nestModules, name, targetFeature);
          }
        }

        // Only the foreign module class, services and exported types are
        // general-purpose interfaces. Other paths need a narrowly scoped
        // reviewed exception, independent of whether the import is type-only.
        if (targetPath) {
          const isModule = targetPath === targetFeature + '.module';
          const isServiceOrType =
            targetPath.startsWith('services/') || targetPath.startsWith('types/');
          // A module may expose an explicit stable root contract while its
          // repositories, policies, selects and internal files stay private.
          const isPublicContract = targetPath === 'public-api';
          if (!isModule && !isServiceOrType && !isPublicContract) {
            errors.push(
              display +
                ": private cross-feature import '" +
                imported.path +
                "'; expose a service/type contract or review an exception",
            );
          }

          const isDependencyInjected =
            !imported.typeOnly &&
            (targetPath.startsWith('services/') || targetPath.startsWith('repositories/'));
          if (isDependencyInjected) {
            const moduleImports = parseModuleImports(moduleSources.get(name), name + '.module.ts');
            if (
              !moduleImports.some(
                (entry) =>
                  entry.path ===
                    '#src/modules/' + targetFeature + '/' + targetFeature + '.module' &&
                  !entry.typeOnly,
              )
            ) {
              errors.push(
                display +
                  ": runtime provider import from '" +
                  targetFeature +
                  "' requires its Nest module in " +
                  name +
                  '.module.ts',
              );
            }

            // Imported service classes must also be exported by their owning
            // Nest module. Type-only symbols and pure public APIs are not DI.
            if (imported.kind === 'static-import' && targetPath.startsWith('services/')) {
              for (const symbol of imported.symbols) {
                if (!moduleMetadata.get(targetFeature).exports.has(symbol)) {
                  errors.push(
                    display +
                      ": provider '" +
                      symbol +
                      "' is not exported by " +
                      targetFeature +
                      '.module.ts',
                  );
                }
              }
            }
          }
        }
      }
    }

    const cleanCycle = firstCycle(cleanGraph);
    if (cleanCycle) {
      const cycle = cleanCycle.map((file) => relative(featureRoot, file).split(sep).join('/'));
      errors.push(name + ': clean architecture file dependency cycle: ' + cycle.join(' -> '));
    }
  }

  const moduleCycle = firstCycle(nestModules);
  if (moduleCycle) {
    errors.push('Nest module dependency cycle: ' + moduleCycle.join(' -> '));
  }
  const runtimeCycle = firstCycle(runtime);
  if (runtimeCycle) {
    errors.push('Runtime feature dependency cycle: ' + runtimeCycle.join(' -> '));
  }

  return [...new Set(errors)].sort();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = checkFeatureDependencies(process.cwd());
  if (errors.length > 0) {
    console.error(
      'Feature dependency violations:\n' + errors.map((error) => ' - ' + error).join('\n'),
    );
    process.exitCode = 1;
  } else {
    console.log('Feature dependency graph and import boundaries: OK');
  }
}
