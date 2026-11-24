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

/**
 * Run dependency-cruiser once for both source import-boundary policies.
 * Manifest checks and the legacy relative-path scanner remain independent.
 */
export function inspectWorkspaceImports(root = repositoryRoot) {
  const { graph, graphErrors } = inspectDependencyCruiserGraph(root);
  const named = findNamedApplicationImports(graph, applicationPackageNames(root));
  const relative = findRelativeWorkspaceImports(graph, discoverWorkspaceRoots(root));
  return { named, relative, graphErrors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { named, relative, graphErrors } = inspectWorkspaceImports();
    const errors = [...new Set([...named, ...relative])].sort();
    if (graphErrors) errors.push('dependency-cruiser graph violations: ' + graphErrors);

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
