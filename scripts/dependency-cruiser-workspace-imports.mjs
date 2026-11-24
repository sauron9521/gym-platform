import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  applicationPackageNames,
  findNamedApplicationImports,
  inspectDependencyCruiserGraph,
} from './dependency-cruiser-named-imports.mjs';
import {
  discoverWorkspaceRoots,
  findRelativeWorkspaceImports,
} from './dependency-cruiser-relative-imports.mjs';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const formatter = resolve(repositoryRoot, 'node_modules/dependency-cruiser/bin/depcruise-fmt.mjs');

/**
 * Run dependency-cruiser once for both source import-boundary policies.
 * Manifest checks and other API architecture policies remain independent.
 */
export function inspectWorkspaceImports(root = repositoryRoot) {
  const { graph, graphErrors } = inspectDependencyCruiserGraph(root);
  const named = findNamedApplicationImports(graph, applicationPackageNames(root));
  const relative = findRelativeWorkspaceImports(graph, discoverWorkspaceRoots(root));
  return { named, relative, graphErrors, graph };
}


/**
 * Reuse the parsed graph for dependency-cruiser's native err-long report.
 * Running depcruise-fmt does not traverse the source tree a second time.
 */
export function formatResolvedCruiserViolations(graph) {
  if (!Number.isInteger(graph?.summary?.error) || graph.summary.error < 0) {
    throw new Error('Invalid dependency-cruiser graph summary for formatting');
  }
  const result = spawnSync(process.execPath, [formatter, '--output-type', 'err-long', '-'], {
    cwd: repositoryRoot,
    input: JSON.stringify(graph),
    encoding: 'utf8',
    timeout: 15_000,
    maxBuffer: 32 * 1024 * 1024,
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error('dependency-cruiser formatter failed: ' + (result.stderr || result.stdout));
  }
  if (graph.summary.error && !result.stdout.trim()) {
    throw new Error('dependency-cruiser formatter returned no details for rule violations');
  }
  return result.stdout.trim();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { named, relative, graphErrors, graph } = inspectWorkspaceImports();
    const errors = [...new Set([...named, ...relative])].sort();
    if (graphErrors) {
      errors.push('dependency-cruiser graph violations: ' + graphErrors);
      errors.push(formatResolvedCruiserViolations(graph));
    }

    if (errors.length) {
      console.error(errors.join('\n'));
      process.exitCode = 1;
    } else {
      console.log('Workspace named and relative imports: OK (dependency-cruiser JSON graph)');
    }
  } catch (error) {
    console.error(
      '[architecture:cruise:boundaries]',
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  }
}
