import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function validateNativeStagingConfig(app, eas) {
  const failures = [];
  const expo = app?.expo;
  const idPattern = /^[a-zA-Z][\w]*(?:\.[a-zA-Z][\w]*){2,}$/;
  if (!idPattern.test(expo?.android?.package ?? '')) {
    failures.push('Provide your reviewed expo.android.package');
  }
  if (!idPattern.test(expo?.ios?.bundleIdentifier ?? '')) {
    failures.push('Provide your reviewed expo.ios.bundleIdentifier');
  }
  if (eas?.build?.preview?.distribution !== 'internal') {
    failures.push('Preview distribution must be internal');
  }
  if (eas?.build?.preview?.android?.buildType !== 'apk') {
    failures.push('Android preview requires an APK');
  }
  if (eas?.build?.preview?.environment !== 'preview') {
    failures.push('Preview must use the isolated EAS preview environment');
  }
  if (eas?.build?.production?.autoIncrement !== true) {
    failures.push('Production build version must be incremented');
  }
  return failures;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
  const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));
  const failures = validateNativeStagingConfig(app, eas);
  if (failures.length) {
    console.error('Native staging preflight NO-GO:\n' + failures.map((s) => '- ' + s).join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Native config preflight OK; real EAS APK and Maestro smoke are still required.');
  }
}
