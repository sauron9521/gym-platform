import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const OWNER = 'sauron9521';
export const REPO = 'sauron9521/gym-platform';
export const PROJECT_TITLE = 'Gym Platform Delivery';
export const STAGES = [
  ['Backlog', 'GRAY', 'Not yet scheduled'],
  ['Ready', 'BLUE', 'Requirements and dependencies checked'],
  ['In Progress', 'YELLOW', 'Implementation underway'],
  ['In Review', 'PURPLE', 'Pull request review and checks'],
  ['Blocked', 'RED', 'Needs a dependency or decision'],
  ['Done', 'GREEN', 'Verified and merged or closed'],
];
export const VIEWS = [
  ['Delivery Board', 'BOARD'],
  ['Milestones', 'TABLE'],
  ['Priority', 'TABLE'],
  ['Areas', 'TABLE'],
];

export function activeIssues(issues) {
  const result = [];
  for (const issue of issues) {
    if (issue.pull_request || issue.state !== 'open') continue;
    const labels = (issue.labels ?? []).map((label) =>
      typeof label === 'string' ? label : label.name,
    );
    if (labels.includes('type:roadmap') || labels.includes('status:deferred')) continue;
    if (!labels.some((label) => label === 'type:task' || label === 'type:epic')) continue;
    const phases = labels.filter((label) => /^phase:M0[1-8]$/.test(label));
    if (phases.length > 1) throw new Error('Issue #' + issue.number + ' has multiple phases');
    if (phases.length === 0 || phases[0] === 'phase:M08') continue;
    const phase = phases[0].slice('phase:'.length);
    if (!issue.milestone?.title?.startsWith(phase + ' — ')) {
      throw new Error('Issue #' + issue.number + ' has an unexpected milestone');
    }
    result.push({ number: issue.number, phase, url: issue.html_url });
  }
  return result.sort((a, b) => a.number - b.number);
}

export function statusOptions(existing) {
  if (!existing || !Array.isArray(existing.options)) throw new Error('Missing Status field');
  const current = existing.options.map(({ name }) => name);
  const wanted = STAGES.map(([name]) => name);
  if (JSON.stringify(current) === JSON.stringify(wanted)) return null;
  if (JSON.stringify(current) !== JSON.stringify(['Todo', 'In Progress', 'Done'])) {
    throw new Error('Status options have been customized; refusing to overwrite');
  }
  const aliases = { Backlog: 'Todo' };
  return STAGES.map(([name, color, description]) => ({
    name,
    color,
    description,
    ...(existing.options.find((option) => option.name === (aliases[name] ?? name))?.id
      ? { id: existing.options.find((option) => option.name === (aliases[name] ?? name)).id }
      : {}),
  }));
}

export function existingProject(projects) {
  const matches = projects.filter((project) => project.title === PROJECT_TITLE);
  if (matches.length > 1) throw new Error('More than one project has the canonical title');
  return matches[0] ?? null;
}

export function missingIssues(issues, projectItems) {
  const existing = new Set(
    projectItems.map((item) => item.content?.url ?? item.url).filter(Boolean),
  );
  return issues.filter((issue) => !existing.has(issue.url));
}

function command(args, input) {
  const result = spawnSync('gh', args, {
    encoding: 'utf8',
    ...(input ? { input } : {}),
    maxBuffer: 12 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      'GitHub CLI command ' +
        args.slice(0, 2).join(' ') +
        ' failed. Check gh auth status and project scope.',
    );
  }
  return result.stdout;
}
function json(args, input) {
  return JSON.parse(command(args, input));
}
function graphql(query, variables) {
  const result = json(['api', 'graphql', '--input', '-'], JSON.stringify({ query, variables }));
  if (result.errors?.length) throw new Error('GitHub GraphQL rejected the Project operation');
  return result.data;
}
function listIssues() {
  const issues = [];
  for (let page = 1; page <= 20; page++) {
    const batch = json(['api', 'repos/' + REPO + '/issues?state=open&per_page=100&page=' + page]);
    if (!Array.isArray(batch)) throw new Error('Expected an Issues page');
    issues.push(...batch);
    if (batch.length < 100) return issues;
  }
  throw new Error('Too many Issues pages');
}
function details(number) {
  const query =
    'query($owner:String!,$number:Int!){user(login:$owner){projectV2(number:$number){' +
    'id,url,field(name:"Status"){... on ProjectV2SingleSelectField{id,options{id,name}}},' +
    'views(first:100){nodes{name,layout}},repositories(first:100){nodes{nameWithOwner}}}}}';
  const result = graphql(query, { owner: OWNER, number });
  if (!result.user?.projectV2) throw new Error('Project not accessible');
  return result.user.projectV2;
}
function items(number) {
  const result = json([
    'project',
    'item-list',
    String(number),
    '--owner',
    OWNER,
    '--limit',
    '1000',
    '--format',
    'json',
  ]);
  if (!Array.isArray(result.items)) throw new Error('Expected Projects items');
  if (result.totalCount > result.items.length) throw new Error('Project item list was truncated');
  return result.items;
}
function setupStatuses(project) {
  const options = statusOptions(project.field);
  if (!options) return;
  const mutation =
    'mutation($input:UpdateProjectV2FieldInput!){updateProjectV2Field(input:$input)' +
    '{projectV2Field{... on ProjectV2SingleSelectField{id}}}}';
  graphql(mutation, { input: { fieldId: project.field.id, singleSelectOptions: options } });
  console.log('Configured six Status stages');
}
function createViews(project) {
  const mutation =
    'mutation($input:CreateProjectV2ViewInput!){createProjectV2View(input:$input)' +
    '{projectV2View{id,name}}}';
  for (const [name, layout] of VIEWS) {
    const existing = project.views.nodes.find((view) => view.name === name);
    if (existing) {
      if (existing.layout !== layout) throw new Error('Wrong layout for view ' + name);
      continue;
    }
    graphql(mutation, { input: { projectId: project.id, name, layout } });
    console.log('Created view ' + name);
  }
}

export function run(args = process.argv.slice(2)) {
  const mode = args[0] ?? 'preview';
  if (!['preview', 'apply'].includes(mode)) throw new Error('Expected preview or apply');
  if (mode === 'apply' && args[1] !== 'APPLY_PROJECT') {
    throw new Error('Apply requires confirmation APPLY_PROJECT');
  }
  const user = json(['api', 'user']);
  if (user.login !== OWNER) throw new Error('GitHub CLI must be logged in as ' + OWNER);
  const selected = activeIssues(listIssues());
  const all = json(['project', 'list', '--owner', OWNER, '--limit', '100', '--format', 'json']);
  const existing = existingProject(all.projects);
  const current = existing ? details(existing.number) : null;
  const projectItems = existing ? items(existing.number) : [];
  const missing = missingIssues(selected, projectItems);
  if (current) {
    statusOptions(current.field);
    for (const [name, layout] of VIEWS) {
      const present = current.views.nodes.find((view) => view.name === name);
      if (present && present.layout !== layout) throw new Error('Existing view mismatch: ' + name);
    }
  }
  const summary = {
    mode,
    project: existing?.url ?? '(new project)',
    selectedIssues: selected.length,
    alreadyInBoard: selected.length - missing.length,
    toImport: missing.length,
    deferredAiExcluded: true,
    views: VIEWS.map(([name]) => name),
  };
  console.log(JSON.stringify(summary, null, 2));
  if (mode === 'preview') return summary;
  const created =
    existing ??
    json(['project', 'create', '--owner', OWNER, '--title', PROJECT_TITLE, '--format', 'json']);
  const number = created.number;
  if (!Number.isInteger(number)) throw new Error('Project create did not return a number');
  let project = details(number);
  if (!project.repositories.nodes.some((repo) => repo.nameWithOwner === REPO)) {
    command(['project', 'link', String(number), '--owner', OWNER, '--repo', REPO]);
    console.log('Linked repository');
  }
  setupStatuses(project);
  project = details(number);
  createViews(project);
  for (const issue of missing) {
    json([
      'project',
      'item-add',
      String(number),
      '--owner',
      OWNER,
      '--url',
      issue.url,
      '--format',
      'json',
    ]);
    command([
      'project',
      'item-edit',
      String(number),
      '--owner',
      OWNER,
      '--url',
      issue.url,
      '--field',
      'Status',
      '--value',
      'Backlog',
    ]);
    console.log('Imported #' + issue.number + ' (' + issue.phase + ') as Backlog');
  }
  const after = items(number);
  if (missingIssues(selected, after).length) throw new Error('Post-import verification failed');
  console.log('Verified ' + selected.length + ' active Issues in ' + (created.url ?? project.url));
  return { ...summary, project: created.url ?? project.url, verified: selected.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Project setup failed');
    process.exitCode = 1;
  }
}
