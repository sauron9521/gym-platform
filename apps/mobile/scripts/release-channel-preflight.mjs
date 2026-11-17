import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Fail closed on preview/production channel crossover. No credentials required. */
export function validateMobileReleaseChannels(eas) {
  const problems = [];
  const preview = eas?.build?.preview;
  const production = eas?.build?.production;
  if (preview?.environment !== 'preview' || preview?.channel !== 'preview') {
    problems.push('Preview must use the preview environment and channel.');
  }
  if (preview?.distribution !== 'internal' || preview?.android?.buildType !== 'apk') {
    problems.push('Preview Android must be an internal APK.');
  }
  if (production?.environment !== 'production' || production?.channel !== 'production') {
    problems.push('Production must use the production environment and channel.');
  }
  if (production?.autoIncrement !== true || production?.distribution === 'internal') {
    problems.push('Production must use increasing versions and non-internal distribution.');
  }
  if (preview?.channel === production?.channel) {
    problems.push('Preview and production channels must differ.');
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));
  const errors = validateMobileReleaseChannels(eas);
  if (errors.length) {
    console.error('Mobile release NO-GO:\n' + errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Channel separation OK (native build/device and API readiness NOT verified).');
  }
}
