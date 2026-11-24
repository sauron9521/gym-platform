import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { inspectWorkspaceImports } from './dependency-cruiser-workspace-imports.mjs';

const dependencyFields = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];
// Source imports are validated by the required dependency-cruiser graph gate.
// This file deliberately reads manifests only; do not reintroduce source parsing.

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
  const workspaces = ['apps', 'packages', 'tooling'].flatMap((kind) => workspacesUnder(root, kind));
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
    workspaces.filter((w) => w.kind !== 'apps').map((w) => [w.name, new Set()]),
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
        } else if (workspace.kind !== 'apps') {
          sharedGraph.get(workspace.name).add(dependency);
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
  // CLI checks manifests and the complete parsed source import graph.
  const { named, relative: imports, graphErrors } = inspectWorkspaceImports(root);
  errors.push(...named, ...imports);
  if (graphErrors) errors.push('dependency-cruiser graph violations: ' + graphErrors);
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Workspace package and cross-app boundaries: OK');
  }
}
