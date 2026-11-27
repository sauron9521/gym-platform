// The ordinary static app.json remains the source of truth. Only the
// explicitly selected, internal QA profile may embed the reminder gate.
function httpsEndpoint(value) {
  if (typeof value !== 'string' || value !== value.trim() || !value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.hostname.includes('.') &&
      !url.hostname.endsWith('.localhost') &&
      !url.hostname.endsWith('.local') &&
      !/^[\d.]+$/.test(url.hostname)
      ? url
      : null;
  } catch {
    return null;
  }
}

function resolveAppConfig(config, env) {
  const extra = { ...config.extra };
  delete extra.reminderQa;
  const profile = env.EAS_BUILD_PROFILE;
  const flag = env.OVRANTO_REMINDER_QA;
  if (profile !== 'reminder-qa') {
    if (flag && flag !== '0') throw new Error('Reminder QA requires the dedicated EAS profile.');
    return { ...config, extra };
  }
  if (flag !== '1') throw new Error('Reminder QA profile requires explicit opt-in.');
  const platform = env.OVRANTO_REMINDER_QA_PLATFORM;
  if (
    !['android', 'ios'].includes(platform) ||
    (env.EAS_BUILD_PLATFORM && env.EAS_BUILD_PLATFORM !== platform)
  )
    throw new Error('Select exactly the matching native QA platform.');
  const api = httpsEndpoint(env.EXPO_PUBLIC_API_URL);
  const staging = httpsEndpoint(env.OVRANTO_REMINDER_QA_API_URL);
  const production = httpsEndpoint(env.OVRANTO_PRODUCTION_API_URL);
  if (
    !api ||
    !staging ||
    !production ||
    api.href !== staging.href ||
    api.origin === production.origin
  )
    throw new Error(
      'Reminder QA requires an explicitly approved HTTPS staging API distinct from production.',
    );
  const appId = env.OVRANTO_REMINDER_QA_APP_ID;
  if (
    typeof appId !== 'string' ||
    !/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+\.reminderqa$/.test(appId) ||
    appId === config.android?.package ||
    appId === config.ios?.bundleIdentifier
  )
    throw new Error('Provide a reviewed separate native QA app ID ending in .reminderqa.');
  return {
    ...config,
    name: 'OVRANTO Reminder QA',
    scheme: 'gymplatform-reminder-qa',
    updates: { ...config.updates, enabled: false },
    ...(platform === 'android'
      ? { android: { ...config.android, package: appId } }
      : { ios: { ...config.ios, bundleIdentifier: appId } }),
    extra: { ...extra, reminderQa: { version: 1, platform, appId, apiUrl: staging.href } },
  };
}

module.exports = ({ config }) => resolveAppConfig(config, process.env);
module.exports.resolveAppConfig = resolveAppConfig;
