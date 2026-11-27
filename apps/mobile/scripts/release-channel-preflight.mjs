import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Static configuration gate only: does not prove EAS credentials, API targets,
 * native identifiers, app signing or a successful native/OTA release.
 */
export function validateMobileReleaseChannels(eas) {
  const problems = [];
  const development = eas?.build?.development;
  const preview = eas?.build?.preview;
  const production = eas?.build?.production;
  const qa = eas?.build?.['reminder-qa'];

  if (eas?.cli?.appVersionSource !== 'remote') {
    problems.push('EAS appVersionSource must be remote.');
  }
  if (
    development?.developmentClient !== true ||
    development?.distribution !== 'internal' ||
    development?.environment !== 'development' ||
    development?.channel !== 'development'
  ) {
    problems.push('Development must use an internal dev client in the development channel.');
  }
  if (preview?.environment !== 'preview' || preview?.channel !== 'preview') {
    problems.push('Preview must use the preview environment and channel.');
  }
  if (preview?.distribution !== 'internal' || preview?.android?.buildType !== 'apk') {
    problems.push('Preview Android must be an internal APK.');
  }
  if (production?.environment !== 'production' || production?.channel !== 'production') {
    problems.push('Production must use the production environment and channel.');
  }
  if (production?.autoIncrement !== true || production?.distribution !== 'store') {
    problems.push('Production requires auto-increment and store distribution.');
  }

  if (
    qa?.environment !== 'preview' ||
    qa?.channel !== 'reminder-qa' ||
    qa?.distribution !== 'internal' ||
    qa?.android?.buildType !== 'apk' ||
    qa?.env?.OVRANTO_REMINDER_QA !== '1' ||
    qa?.extends ||
    qa?.developmentClient
  ) {
    problems.push('Reminder QA must use its own internal APK profile and preview environment.');
  }
  for (const [name, profile] of Object.entries(eas?.build ?? {})) {
    if (
      name !== 'reminder-qa' &&
      ((profile?.env?.OVRANTO_REMINDER_QA && profile.env.OVRANTO_REMINDER_QA !== '0') ||
        profile?.extends === 'reminder-qa')
    )
      problems.push('Reminder QA opt-in must not leak to other build profiles.');
  }
  const channels = [development?.channel, preview?.channel, production?.channel, qa?.channel];
  if (channels.some((channel) => typeof channel !== 'string') || new Set(channels).size !== 4) {
    problems.push('Development, preview, production and reminder QA channels must be distinct.');
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));
  const failures = validateMobileReleaseChannels(eas);
  if (failures.length) {
    console.error('Mobile release channels NO-GO:\n' + failures.map((x) => '- ' + x).join('\n'));
    process.exitCode = 1;
  } else {
    console.log(
      'Channel configuration OK. Native builds, identifiers and API readiness NOT verified.',
    );
  }
}
