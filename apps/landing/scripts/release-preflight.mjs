import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function releaseErrors(env = process.env) {
  const issues = [];
  const configured = env.LANDING_SITE_URL?.trim();

  if (!configured) {
    issues.push('LANDING_SITE_URL must be configured with a verified public HTTPS origin.');
  } else {
    try {
      const url = new URL(configured);
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.pathname !== '/' ||
        url.search ||
        url.hash ||
        url.hostname === 'localhost' ||
        url.hostname.endsWith('.test') ||
        url.hostname.endsWith('.example')
      ) {
        issues.push('LANDING_SITE_URL must be a verified production HTTPS origin.');
      }
    } catch {
      issues.push('LANDING_SITE_URL is not a valid URL.');
    }
  }

  if (env.LANDING_ALLOW_INDEXING !== 'true') {
    issues.push('LANDING_ALLOW_INDEXING must be true only after content is approved.');
  }

  const analyticsValues = [
    env.NEXT_PUBLIC_UMAMI_WEBSITE_ID,
    env.NEXT_PUBLIC_UMAMI_SCRIPT_URL,
  ];
  if (analyticsValues.some(Boolean) && !analyticsValues.every(Boolean)) {
    issues.push('Either configure both analytics settings or leave both unset.');
  }

  return issues;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const issues = releaseErrors();
  if (issues.length) {
    for (const issue of issues) console.error('Release preflight: ' + issue);
    process.exitCode = 1;
  } else {
    console.log('Landing release environment preflight passed.');
  }
}
