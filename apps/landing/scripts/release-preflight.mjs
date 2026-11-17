import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Fail-closed release configuration shape checks.
 * This cannot prove ownership of a domain, certificate health or approval.
 */
export function releaseErrors(env = process.env) {
  const issues = [];
  const configured = env.LANDING_SITE_URL?.trim();

  if (!configured) {
    issues.push('LANDING_SITE_URL must be set to a verified public HTTPS origin.');
  } else {
    try {
      const url = new URL(configured);
      const hostname = url.hostname.toLowerCase();
      const publicHost =
        /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(
          hostname,
        ) &&
        !['.localhost', '.local', '.internal', '.test', '.example', '.invalid'].some(
          (suffix) => hostname.endsWith(suffix),
        );
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.pathname !== '/' ||
        url.search ||
        url.hash ||
        url.port ||
        !publicHost
      ) {
        issues.push('LANDING_SITE_URL must be a public HTTPS origin without credentials, port or path.');
      }
    } catch {
      issues.push('LANDING_SITE_URL is not a valid URL.');
    }
  }

  // A public staging/preview release may intentionally remain noindex.
  if (
    env.LANDING_ALLOW_INDEXING !== undefined &&
    env.LANDING_ALLOW_INDEXING !== 'true' &&
    env.LANDING_ALLOW_INDEXING !== 'false'
  ) {
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
        issues.push('Analytics script URL must be a trusted HTTPS .js URL without query or fragment.');
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
    console.log('Landing release configuration checks passed; manual release gates still apply.');
  }
}
