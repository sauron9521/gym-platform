import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const reservedTlds = new Set(['localhost', 'local', 'internal', 'test', 'example', 'invalid']);

function isPublicHostname(hostname) {
  const labels = hostname.toLowerCase().split('.');

  return (
    labels.length > 1 &&
    labels.every((label) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)) &&
    !labels.every((label) => /^\d+$/.test(label)) &&
    !reservedTlds.has(labels.at(-1))
  );
}

/**
 * Validate configuration shape; domain ownership and launch approval are manual gates.
 */
export function releaseErrors(env = process.env) {
  const issues = [];
  const siteUrl = env.LANDING_SITE_URL?.trim();

  if (!siteUrl) {
    issues.push('LANDING_SITE_URL must be set to a verified HTTPS origin.');
  } else {
    try {
      const url = new URL(siteUrl);
      if (
        url.protocol !== 'https:' ||
        !isPublicHostname(url.hostname) ||
        url.username ||
        url.password ||
        url.pathname !== '/' ||
        url.search ||
        url.hash ||
        url.port
      ) {
        issues.push('Use a public HTTPS origin without a path, port or credentials.');
      }
    } catch {
      issues.push('LANDING_SITE_URL is not a valid URL.');
    }
  }

  const index = env.LANDING_ALLOW_INDEXING;
  if (index !== undefined && index !== 'true' && index !== 'false') {
    issues.push('LANDING_ALLOW_INDEXING must be true, false or unset.');
  }

  const websiteId = env.NEXT_PUBLIC_UMAMI_WEBSITE_ID?.trim();
  const scriptUrl = env.NEXT_PUBLIC_UMAMI_SCRIPT_URL?.trim();

  if (Boolean(websiteId) !== Boolean(scriptUrl)) {
    issues.push('Either configure both analytics settings or leave both unset.');
  } else if (websiteId && scriptUrl) {
    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(websiteId)) {
      issues.push('Analytics website ID must be a valid UUID.');
    }
    try {
      const url = new URL(scriptUrl);
      if (
        url.protocol !== 'https:' ||
        !url.hostname ||
        url.username ||
        url.password ||
        url.hash ||
        url.search ||
        !url.pathname.endsWith('.js')
      ) {
        issues.push('Use a trusted HTTPS JavaScript URL for analytics.');
      }
    } catch {
      issues.push('Analytics script URL is invalid.');
    }
  }

  return issues;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const issues = releaseErrors();
  if (issues.length) {
    for (const issue of issues) console.error('Release preflight: ' + issue);
    process.exitCode = 1;
  } else {
    console.log('Release preflight passed. Manual checks are still required.');
  }
}
