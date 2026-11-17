import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { validateMobileReleaseChannels } from '../scripts/release-channel-preflight.mjs';

const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));

describe('mobile EAS release-channel policy', () => {
  it('separates development, preview and production profiles', () => {
    expect(validateMobileReleaseChannels(eas)).toEqual([]);
  });

  it('rejects preview and production environment/channel crossovers', () => {
    const unsafe = structuredClone(eas);
    unsafe.build.preview.channel = 'production';
    unsafe.build.production.environment = 'preview';

    const errors = validateMobileReleaseChannels(unsafe);
    expect(errors.some((x) => x.includes('Preview must'))).toBe(true);
    expect(errors.some((x) => x.includes('Production must'))).toBe(true);
    expect(errors.some((x) => x.includes('channels must be distinct'))).toBe(true);
  });

  it('refuses a non-APK preview or production internal distribution', () => {
    const unsafe = structuredClone(eas);
    unsafe.build.preview.android.buildType = 'app-bundle';
    unsafe.build.production.distribution = 'internal';

    const errors = validateMobileReleaseChannels(unsafe);
    expect(errors.some((x) => x.includes('internal APK'))).toBe(true);
    expect(errors.some((x) => x.includes('store distribution'))).toBe(true);
  });

  it('requires independent development and remote production versioning', () => {
    const unsafe = structuredClone(eas);
    unsafe.build.development.channel = 'preview';
    unsafe.cli.appVersionSource = 'local';
    unsafe.build.production.autoIncrement = false;

    const errors = validateMobileReleaseChannels(unsafe);
    expect(errors.some((x) => x.includes('Development must'))).toBe(true);
    expect(errors.some((x) => x.includes('appVersionSource'))).toBe(true);
    expect(errors.some((x) => x.includes('auto-increment'))).toBe(true);
  });

  it('fails closed when profiles or channel identifiers are missing', () => {
    expect(validateMobileReleaseChannels({}).length).toBeGreaterThan(0);
    expect(validateMobileReleaseChannels(null).length).toBeGreaterThan(0);

    const unsafe = structuredClone(eas);
    delete unsafe.build.preview.channel;
    expect(validateMobileReleaseChannels(unsafe).length).toBeGreaterThan(0);
  });
});
