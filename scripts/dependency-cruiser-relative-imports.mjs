import { existsSync, readdirSync } from 'node:fs';
import { posix, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { inspectDependencyCruiserGraph } from './dependency-cruiser-named-imports.mjs';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const workspaceSource = /^(?:apps|packages|tooling)\/[^/]+\/src\//;
const workspaceKinds = ['apps', 'packages', 'tooling'];

function isWithin(path, directory) {
  return path === directory || path.startsWith(directory + '/');
}

/**
 * Match workspace roots from existing manifests, just like the required legacy
 * checker. Shared workspace imports must use public package exports.
 */
export function discoverWorkspaceRoots(root) {
  const paths = [];
  for (const kind of workspaceKinds) {
    const parent = join(root, kind);
    if (!existsSync(parent)) continue;
    for (const entry of readdirSync(parent, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (existsSync(join(parent, entry.name, 'package.json'))) {
        paths.push(kind + '/' + entry.name);
      }
    }
  }
  return paths.sort();
}

/**
 * Analyze the parsed original import specifier, not the resolved target path.
 * Missing targets can still cross package boundaries.
 */
export function findRelativeWorkspaceImports(graph, workspaces) {
  if (!Array.isArray(graph?.modules) || !Array.isArray(workspaces)) {
    throw new Error('Invalid dependency-cruiser graph or workspace roots');
  }
  if (workspaces.some((entry) => typeof entry !== 'string' || !entry.trim())) {
    throw new Error('Invalid workspace root');
  }

  const violations = new Set();
  for (const file of graph.modules) {
    const source = typeof file?.source === 'string' ? file.source.replaceAll('\\', '/') : '';
    if (!workspaceSource.test(source)) continue;
    const owner = workspaces.find((directory) => isWithin(source, directory));
    if (!owner) continue;
    if (!Array.isArray(file.dependencies)) {
      throw new Error('Invalid dependency list in dependency-cruiser graph: ' + source);
    }
    for (const edge of file.dependencies) {
      const specifier = edge?.module;
      if (typeof specifier !== 'string' || !specifier.startsWith('.')) continue;

      const destination = posix.normalize(
        posix.join(posix.dirname(source), specifier.replaceAll('\\', '/')),
      );
      const foreign = workspaces.find(
        (directory) => directory !== owner && isWithin(destination, directory),
      );
      if (foreign) {
        violations.add(
          source +
            ': cross-workspace relative import ' +
            specifier +
            ' (use public package exports)',
        );
      }
    }
  }
  return [...violations].sort();
}

export function inspectRelativeWorkspaceImports(root = repositoryRoot) {
  const { graph, graphErrors } = inspectDependencyCruiserGraph(root);
  const workspaces = discoverWorkspaceRoots(root);
  if (!workspaces.length) throw new Error('No workspace manifests found');
  const violations = findRelativeWorkspaceImports(graph, workspaces);
  return { violations, graphErrors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { violations, graphErrors } = inspectRelativeWorkspaceImports();
    if (violations.length || graphErrors) {
      if (violations.length) console.error(violations.join('\n'));
      if (graphErrors) console.error('dependency-cruiser graph violations: ' + graphErrors);
      process.exitCode = 1;
    } else {
      console.log('Relative workspace imports: OK (dependency-cruiser JSON graph)');
    }
  } catch (error) {
    console.error('[architecture:cruise:relative]', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
