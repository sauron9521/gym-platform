import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function validateNativeStagingConfig(app, eas, { platform = 'all' } = {}) {
  const failures = [];
  if (!['all', 'android', 'ios'].includes(platform)) {
    return ['Invalid --platform. Choose android, ios, or all.'];
  }
  const expo = app?.expo;
  const idPattern = /^[a-zA-Z][\w]*(?:\.[a-zA-Z][\w]*){2,}$/;
  if (platform !== 'ios' && !idPattern.test(expo?.android?.package ?? '')) {
    failures.push('Provide your reviewed expo.android.package');
  }
  if (platform !== 'android' && !idPattern.test(expo?.ios?.bundleIdentifier ?? '')) {
    failures.push('Provide your reviewed expo.ios.bundleIdentifier');
  }
  if (eas?.build?.preview?.distribution !== 'internal') {
    failures.push('Preview distribution must be internal');
  }
  if (platform !== 'ios' && eas?.build?.preview?.android?.buildType !== 'apk') {
    failures.push('Android preview requires an APK');
  }
  if (eas?.build?.preview?.environment !== 'preview') {
    failures.push('Preview must use the isolated EAS preview environment');
  }
  if (eas?.cli?.appVersionSource !== 'remote') {
    failures.push('EAS appVersionSource must be remote');
  }
  if (eas?.build?.production?.autoIncrement !== true) {
    failures.push('Production build version must be incremented');
  }
  return failures;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
  const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));
  const args = process.argv.slice(2);
  const selectedPlatform =
    args.length === 0 ? 'all' : args.length === 2 && args[0] === '--platform' ? args[1] : 'invalid';
  const failures = validateNativeStagingConfig(app, eas, { platform: selectedPlatform });
  if (failures.length) {
    console.error('Native staging preflight NO-GO:\n' + failures.map((s) => '- ' + s).join('\n'));
    process.exitCode = 1;
  } else {
    console.log(
      `Native ${selectedPlatform} config preflight OK; EAS linking, trusted staging APK and Maestro smoke are still required.`,
    );
  }
}
