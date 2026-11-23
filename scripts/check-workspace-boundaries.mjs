import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const dependencyFields = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];
const sourceExtensions = /\.(?:[cm]?[jt]sx?)$/;
const skippedDirectories = new Set([
  'node_modules',
  '.next',
  '.expo',
  'dist',
  'build',
  'coverage',
  'generated',
]);

// Conservatively extract literal static/re-export, side-effect and dynamic import paths.
// This is an additional cross-workspace guard, not a complete TypeScript parser.
const importSpecifier = /\b(?:from\s*|import\s*(?:\(\s*)?|require\s*\(\s*)['"]([^'"\r\n]+)['"]/g;

function within(directory, target) {
  const path = relative(directory, target);
  return path === '' || (path !== '..' && !path.startsWith('..' + sep) && !isAbsolute(path));
}

function walkSources(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((item) => {
    const path = join(directory, item.name);
    if (item.isDirectory() && !skippedDirectories.has(item.name)) return walkSources(path);
    return item.isFile() && sourceExtensions.test(item.name) ? [path] : [];
  });
}

function workspacesUnder(root, kind) {
  const folder = join(root, kind);
  if (!existsSync(folder)) return [];
  return readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const directory = join(folder, entry.name);
      const manifestPath = join(directory, 'package.json');
      if (!existsSync(manifestPath)) return [];
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      return [{ kind, directory, manifest, name: manifest.name }];
    });
}

export function checkWorkspaceBoundaries(repositoryRoot) {
  const root = resolve(repositoryRoot);
  const errors = [];
  const workspaces = [...workspacesUnder(root, 'apps'), ...workspacesUnder(root, 'packages')];
  const byName = new Map();
  for (const workspace of workspaces) {
    if (!workspace.name) {
      errors.push(relative(root, workspace.directory) + ': missing package name');
    } else if (byName.has(workspace.name)) {
      errors.push(workspace.name + ': duplicate workspace package name');
    } else {
      byName.set(workspace.name, workspace);
    }
  }

  const sharedGraph = new Map(
    workspaces.filter((w) => w.kind === 'packages').map((w) => [w.name, new Set()]),
  );

  for (const workspace of workspaces) {
    for (const field of dependencyFields) {
      for (const dependency of Object.keys(workspace.manifest[field] ?? {})) {
        const target = byName.get(dependency);
        if (!target) continue;
        if (target.kind === 'apps') {
          errors.push(
            workspace.name + ': must not depend on app ' + dependency + ' (' + field + ')',
          );
        } else if (workspace.kind === 'packages') {
          sharedGraph.get(workspace.name).add(dependency);
        }
      }
    }

    for (const file of walkSources(join(workspace.directory, 'src'))) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(importSpecifier)) {
        const specifier = match[1];
        const namedTarget = byName.get(specifier);
        if (namedTarget?.kind === 'apps') {
          errors.push(relative(root, file) + ': import of application ' + specifier);
          continue;
        }
        if (!specifier.startsWith('.')) continue;
        const absoluteTarget = resolve(dirname(file), specifier);
        const foreign = workspaces.find(
          (candidate) => candidate !== workspace && within(candidate.directory, absoluteTarget),
        );
        if (foreign?.kind === 'apps' || (workspace.kind === 'packages' && foreign)) {
          errors.push(
            relative(root, file) +
              ': cross-workspace relative import ' +
              specifier +
              ' (use public package exports)',
          );
        }
      }
    }
  }

  const visited = new Set();
  const visiting = new Set();
  function traverse(name, stack) {
    if (visiting.has(name)) {
      errors.push('Shared package dependency cycle: ' + [...stack, name].join(' -> '));
      return;
    }
    if (visited.has(name)) return;
    visiting.add(name);
    for (const target of sharedGraph.get(name) ?? []) traverse(target, [...stack, name]);
    visiting.delete(name);
    visited.add(name);
  }
  for (const name of sharedGraph.keys()) traverse(name, []);

  return [...new Set(errors)].sort();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const errors = checkWorkspaceBoundaries(root);
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Workspace package and cross-app boundaries: OK');
  }
}
