import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Milestone definitions mirror the master roadmap in issue #353. */
export const milestones = [
  ['M01', 'Identity & Admin Security', 'E1–E2: RBAC, sessions, admin API and audit.'],
  ['M02', 'OVRANTO Brand & Cross-product UX', 'E19–E20: design, branding and a11y.'],
  ['M03', 'Platform Core & Shared Packages', 'E7/E9/E16: API performance, i18n and CI.'],
  ['M04', 'Athlete Product Features', 'E3–E5/E11: records, templates and calendars.'],
  ['M05', 'Trainer Product & Program Builder', 'E6/E10/E14/E15: trainer app and builder.'],
  ['M06', 'Mobile Reliability & Offline Sync', 'E8/E12: native UX and safe offline sync.'],
  ['M07', 'Beta Quality & Release Evidence', 'E13: real staging, E2E and recovery evidence.'],
  ['M08', 'AI-ready Data & Contracts (Later)', 'E17 only: privacy and contracts, no AI calls.'],
];

/** Recognize a managed milestone by its stable code, not its display name. */
export function milestoneCode(title) {
  return /^(M0[1-8])(?=\s|$)/.exec(title ?? '')?.[1] ?? null;
}

export function issuePhase(issue, includeAi = false) {
  if (issue.pull_request) return null;
  const labels = (issue.labels ?? []).map((item) =>
    typeof item === 'string' ? item : item.name,
  );
  if (labels.includes('type:roadmap') || labels.includes('status:deferred')) return null;
  const phases = labels.filter((name) => /^phase:M0[1-8]$/.test(name));
  if (phases.length > 1) throw new Error('Conflicting phase labels on #' + issue.number);
  if (phases.length === 0) return null;
  if (!labels.includes('type:task') && !labels.includes('type:epic')) {
    throw new Error('Invalid managed issue type on #' + issue.number);
  }
  const code = phases[0].slice('phase:'.length);
  return code === 'M08' && !includeAi ? null : code;
}

/** Pre-validate the entire plan before making the first write. */
export function buildPlan(issues, existing, includeAi = false) {
  const active = milestones.filter(([code]) => includeAi || code !== 'M08');
  const activeCodes = new Set(active.map(([code]) => code));
  const current = new Map();
  for (const milestone of existing) {
    const code = milestoneCode(milestone.title);
    if (!activeCodes.has(code)) continue;
    if (current.has(code)) throw new Error('Duplicate milestone ' + code);
    if (milestone.state !== 'open') {
      throw new Error('Existing milestone is closed: ' + code);
    }
    current.set(code, milestone);
  }

  const create = active.filter(([code]) => !current.has(code));
  const assign = [];
  let alreadyAssigned = 0;
  const counts = Object.fromEntries(active.map(([code]) => [code, 0]));
  for (const issue of issues) {
    const code = issuePhase(issue, includeAi);
    if (!code) continue;
    counts[code]++;
    if (issue.milestone) {
      if (milestoneCode(issue.milestone.title) !== code) {
        throw new Error('Unexpected existing milestone on #' + issue.number);
      }
      alreadyAssigned++;
      continue;
    }
    assign.push({ issueNumber: issue.number, code });
  }
  return { create, assign, alreadyAssigned, counts, current };
}

async function api(token, repo, method, path, payload) {
  const response = await fetch('https://api.github.com/repos/' + repo + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'gym-platform-roadmap-sync',
      ...(payload ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  // Do not echo raw provider errors or authentication details.
  if (!response.ok) {
    throw new Error('GitHub ' + method + ' failed with HTTP ' + response.status);
  }
  return response.json();
}

async function listAll(token, repo, path) {
  const result = [];
  for (let page = 1; page <= 40; page++) {
    const separator = path.includes('?') ? '&' : '?';
    const data = await api(
      token,
      repo,
      'GET',
      path + separator + 'per_page=100&page=' + page,
    );
    if (!Array.isArray(data)) throw new Error('Invalid GitHub pagination response');
    result.push(...data);
    if (data.length < 100) return result;
  }
  throw new Error('Too many GitHub pages');
}

export async function run(env = process.env) {
  if (env.GITHUB_REPOSITORY !== 'sauron9521/gym-platform') {
    throw new Error('Only the canonical Gym Platform repository is supported');
  }
  if (env.GITHUB_REF !== 'refs/heads/main') {
    throw new Error('Milestone sync requires main');
  }
  const mode = env.ROADMAP_MODE || 'preview';
  if (mode !== 'preview' && mode !== 'apply') throw new Error('Unknown mode');
  if (mode === 'apply' && env.ROADMAP_CONFIRM !== 'APPLY_MILESTONES') {
    throw new Error('Explicit APPLY_MILESTONES confirmation required');
  }
  if (!env.GITHUB_TOKEN) throw new Error('Missing GitHub Actions token');

  const repo = env.GITHUB_REPOSITORY;
  const token = env.GITHUB_TOKEN;
  const includeAi = env.ROADMAP_INCLUDE_AI === 'true';
  const [issues, existing] = await Promise.all([
    listAll(token, repo, '/issues?state=open'),
    listAll(token, repo, '/milestones?state=all'),
  ]);
  const plan = buildPlan(issues, existing, includeAi);
  console.log(
    JSON.stringify({
      mode,
      includeAi,
      create: plan.create.map(([code]) => code),
      assign: plan.assign.length,
      alreadyAssigned: plan.alreadyAssigned,
      counts: plan.counts,
    }),
  );
  if (mode === 'preview') return;

  const ids = new Map([...plan.current].map(([code, value]) => [code, value.number]));
  for (const [code, name, description] of plan.create) {
    const result = await api(token, repo, 'POST', '/milestones', {
      title: code + ' — ' + name,
      description,
      state: 'open',
    });
    ids.set(code, result.number);
    console.log('Created milestone ' + code);
  }
  for (const { issueNumber, code } of plan.assign) {
    const number = ids.get(code);
    if (!Number.isInteger(number)) throw new Error('Milestone not found: ' + code);
    await api(token, repo, 'PATCH', '/issues/' + issueNumber, {
      milestone: number,
    });
    console.log('Assigned #' + issueNumber + ' to ' + code);
  }

  const updated = await listAll(token, repo, '/issues?state=open');
  const byNumber = new Map(updated.filter((issue) => !issue.pull_request).map((issue) => [
    issue.number,
    issue,
  ]));
  for (const issue of issues) {
    const code = issuePhase(issue, includeAi);
    if (!code || issue.pull_request) continue;
    const now = byNumber.get(issue.number);
    if (!now || milestoneCode(now.milestone?.title) !== code) {
      throw new Error('Verification failed for issue #' + issue.number);
    }
  }
  console.log('All managed open issues have the expected milestone.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await run();
}
