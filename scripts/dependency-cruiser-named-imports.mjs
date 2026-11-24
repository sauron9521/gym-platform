import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const workspaceSource = /^(?:apps|packages|tooling)\/[^/]+\/src\//;

/**
 * Discover application package names from the same workspace manifests used
 * by the legacy guard. Never hard-code the list or match the @gym prefix alone.
 */
export function applicationPackageNames(root) {
  const apps = join(root, 'apps');
  if (!existsSync(apps)) throw new Error('Missing apps workspace directory');

  const names = new Set();
  for (const entry of readdirSync(apps, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifest = join(apps, entry.name, 'package.json');
    if (!existsSync(manifest)) continue;
    const { name } = JSON.parse(readFileSync(manifest, 'utf8'));
    if (typeof name !== 'string' || !name.trim() || names.has(name)) {
      throw new Error('Missing or duplicate application package name: ' + manifest);
    }
    names.add(name);
  }
  if (!names.size) throw new Error('No application package manifests found');
  return names;
}

/**
 * Use dependency-cruiser's parsed import specifier, not another source-text
 * parser. The "module" field retains the literal name even when workspace
 * resolution fails (where a rule on the resolved "path" may miss the import).
 */
export function findNamedApplicationImports(report, appNames) {
  if (!Array.isArray(report?.modules) || !(appNames instanceof Set)) {
    throw new Error('Invalid dependency-cruiser graph or application names');
  }

  const messages = new Set();
  for (const file of report.modules) {
    const source = file?.source?.replaceAll('\\', '/');
    if (!source || !workspaceSource.test(source)) continue;
    if (!Array.isArray(file.dependencies)) {
      throw new Error('Invalid dependency list in dependency-cruiser graph: ' + source);
    }
    for (const edge of file.dependencies) {
      // Preserve the legacy rule: only exact application package imports.
      if (appNames.has(edge?.module)) {
        messages.add(source + ': import of application ' + edge.module);
      }
    }
  }
  return [...messages].sort();
}

export function inspectDependencyCruiserGraph(root = repositoryRoot) {
  const bin = resolve(repositoryRoot, 'node_modules/dependency-cruiser/bin/dependency-cruiser.mjs');
  const configuration = resolve(repositoryRoot, '.dependency-cruiser.cjs');
  // Fixture repositories may have no tooling directory. Analyze existing roots only.
  const roots = ['apps', 'packages', 'tooling'].filter((name) => existsSync(join(root, name)));
  if (!roots.includes('apps')) throw new Error('Missing apps workspace directory');
  const result = spawnSync(
    process.execPath,
    [bin, '--config', configuration, '--output-type', 'json', ...roots],
    {
      cwd: root,
      encoding: 'utf8',
      timeout: 120_000,
      maxBuffer: 32 * 1024 * 1024,
      shell: false,
    },
  );

  if (result.error) throw result.error;
  if (result.status !== 0 && result.status !== 1) {
    throw new Error('dependency-cruiser failed: ' + (result.stderr || result.stdout));
  }

  let graph;
  try {
    graph = JSON.parse(result.stdout);
  } catch {
    throw new Error('dependency-cruiser did not return a valid JSON graph');
  }

  const graphErrors = graph.summary?.error;
  if (!Number.isInteger(graphErrors) || graphErrors < 0) {
    throw new Error('dependency-cruiser JSON graph is missing its error count');
  }
  return { graph, graphErrors };
}

export function inspectNamedApplicationImports(root = repositoryRoot) {
  const { graph, graphErrors } = inspectDependencyCruiserGraph(root);
  const violations = findNamedApplicationImports(graph, applicationPackageNames(root));
  return { violations, graphErrors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { violations, graphErrors } = inspectNamedApplicationImports();
    if (violations.length || graphErrors) {
      if (violations.length) console.error(violations.join('\n'));
      if (graphErrors) console.error('dependency-cruiser graph violations: ' + graphErrors);
      process.exitCode = 1;
    } else {
      console.log('Named application imports: OK (dependency-cruiser JSON graph)');
    }
  } catch (error) {
    console.error('[architecture:cruise:named]', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
