import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { test } from 'vitest';

const root = fileURLToPath(new URL('../', import.meta.url));
const index = 'docs/README.md';

function nodes(tree) {
  return [tree, ...(tree.children ?? []).flatMap(nodes)];
}

function relativeTarget(file, url) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(url)) return null;
  const path = url.split(/[?#]/, 1)[0];
  if (!path) return null;
  return posix.normalize(posix.join(posix.dirname(file), decodeURIComponent(path)));
}

function inspect(files, read) {
  const tracked = new Set(files);
  const markdown = files.filter((file) => /\.md$/i.test(file));
  const graph = new Map();
  const errors = [];
  for (const file of markdown) {
    const ast = nodes(fromMarkdown(read(file)));
    const definitions = new Map();
    for (const node of ast) {
      if (node.type === 'definition' && !definitions.has(node.identifier)) {
        definitions.set(node.identifier, node.url);
      }
    }
    const edges = new Set();
    for (const node of ast) {
      const url = ['link', 'image'].includes(node.type)
        ? node.url
        : ['linkReference', 'imageReference'].includes(node.type)
          ? definitions.get(node.identifier)
          : undefined;
      if (url === undefined) continue;
      try {
        const target = relativeTarget(file, url);
        if (target === null) continue;
        const path = target.replace(/\/$/, '');
        const directory = path === '.' || files.some((entry) => entry.startsWith(`${path}/`));
        if (!tracked.has(path) && !directory) {
          errors.push(`${file}:${node.position.start.line}: missing tracked target ${url}`);
        } else if (node.type === 'link' || node.type === 'linkReference') {
          if (tracked.has(path)) edges.add(path);
          else {
            const readme = posix.join(path, 'README.md');
            if (tracked.has(readme)) edges.add(readme);
          }
        }
      } catch {
        errors.push(`${file}:${node.position.start.line}: invalid relative URL ${url}`);
      }
    }
    graph.set(file, edges);
  }
  const reached = new Set();
  const pending = [index];
  while (pending.length) {
    const file = pending.pop();
    if (reached.has(file) || !graph.has(file)) continue;
    reached.add(file);
    pending.push(...graph.get(file));
  }
  return {
    errors,
    unreachable: markdown.filter((file) => file.startsWith('docs/') && !reached.has(file)),
  };
}

function fixture(entries) {
  return inspect(Object.keys(entries), (file) => entries[file]);
}

test('Markdown links resolve, including references, escaped spaces, images and directories', () => {
  const result = fixture({
    [index]:
      '[Guide][g] · [Directory](nested/) · ![Logo](../assets/logo.png)\n\n[g]: guide%20one.md#section\n\n`[fake](missing.md)`\n\n```md\n[example](missing.md)\n```\n\n[external](https://example.org/missing) [anchor](#heading)',
    'docs/guide one.md': '# Guide',
    'docs/nested/README.md': '# Nested',
    'assets/logo.png': '',
  });
  assert.deepEqual(result, { errors: [], unreachable: [] });
});

test('missing tracked targets and disconnected documentation fail independently', () => {
  const result = fixture({
    [index]: '[Broken](Missing.md) [Outside](../../outside.md) [Bad encoding](%ZZ.md)',
    'docs/missing.md': '# Case-sensitive name',
    'docs/orphan.md': '[Other](missing.md)',
  });
  assert.equal(result.errors.length, 3);
  assert.deepEqual(result.unreachable.sort(), ['docs/missing.md', 'docs/orphan.md']);
});

test('every tracked Markdown relative target exists and docs are reachable from their index', () => {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
  assert.ok(files.includes(index), 'Documentation index is missing');
  const result = inspect(files, (file) =>
    readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'),
  );
  assert.deepEqual(result.errors, [], 'Broken relative Markdown links');
  assert.deepEqual(result.unreachable, [], 'Link each document from its owning index');
});
