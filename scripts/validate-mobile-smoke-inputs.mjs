import { pathToFileURL } from 'node:url';

/**
 * Fail closed before installing an externally hosted APK on the emulator.
 * This protects against accidental production use and most URL typos;
 * operators must still verify the EAS project and SHA-256 provenance.
 */
export function validateMobileSmokeInputs({ apkUrl, apkSha256, appId }) {
  let url;
  try {
    url = new URL(apkUrl);
  } catch {
    throw new Error('APK URL must be a valid Expo EAS HTTPS artifact URL.');
  }

  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'expo.dev' ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^\/artifacts\/eas\/[A-Za-z0-9._-]+\.apk$/.test(url.pathname)
  ) {
    throw new Error('APK URL must be a direct https://expo.dev/artifacts/eas/*.apk link.');
  }
  if (!/^[a-fA-F0-9]{64}$/.test(apkSha256 ?? '')) {
    throw new Error('APK SHA-256 must contain exactly 64 hexadecimal characters.');
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)+$/.test(appId ?? '')) {
    throw new Error('Android application ID must be a valid dotted package name.');
  }
  return { url: url.href, sha256: apkSha256.toLowerCase(), appId };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    validateMobileSmokeInputs({
      apkUrl: process.env.APK_URL,
      apkSha256: process.env.APK_SHA256,
      appId: process.env.APP_ID,
    });
    console.log('Mobile smoke inputs validated (EAS host, package ID and SHA-256 syntax).');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Invalid smoke inputs.');
    process.exitCode = 1;
  }
}
