import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'vitest';
import { ovrantoNativePalette } from '@gym/design-tokens/ovranto-native';

const read = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('UniWind is configured only for the mobile Expo app', () => {
  const metro = read('../metro.config.js');
  const css = read('../global.css');
  assert.match(metro, /withUniwindConfig/);
  assert.match(css, /@layer theme \{/);
  assert.match(css, /\.light \{/);
  assert.match(css, /\.dark \{/);
});

test('root navigation provides safe areas and hides iOS group labels in back buttons', () => {
  const layout = read('../src/app/_layout.tsx');
  assert.ok(layout.includes('<SafeAreaProvider>'));
  assert.ok(layout.includes("headerBackButtonDisplayMode: 'minimal'"));
  assert.ok(layout.includes('name="(tabs)" options={{ title: '));
});

test('native form scroll views preserve safe-area and keyboard behavior', () => {
  for (const [path, id] of [
    ['../src/screens/profile/ui/edit-profile-screen.tsx', 'profile-edit-scroll'],
    ['../src/screens/workouts/ui/create-workout-screen.tsx', 'create-workout-scroll'],
    ['../src/screens/workouts/ui/workout-details-screen.tsx', 'workout-details-scroll'],
  ]) {
    const screen = read(path);
    assert.ok(screen.includes(`testID="${id}"`), id);
    assert.ok(screen.includes('contentInsetAdjustmentBehavior="automatic"'), id);
    assert.ok(screen.includes('automaticallyAdjustKeyboardInsets'), id);
    assert.ok(screen.includes('keyboardShouldPersistTaps="handled"'), id);
    assert.ok(screen.includes('alwaysBounceVertical={false}'), id);
    if (id === 'workout-details-scroll') {
      assert.match(screen, /paddingBottom: 24/, id);
      assert.match(screen, /keyboardDismissMode=/, id);
      const route = read('../src/app/workouts/[id].tsx');
      assert.match(route, /<SafeAreaView/);
      assert.ok(route.includes("edges={['left', 'right', 'bottom']}"));
    } else {
      assert.match(screen, /paddingBottom: 64/, id);
    }
    assert.ok(!screen.includes('bounces={false}'), id);
  }
});

test('Gluestack root provider preserves authenticated route guards', () => {
  const layout = read('../src/app/_layout.tsx');
  assert.match(layout, /<GluestackUIProvider/);
  assert.match(
    layout,
    /<Stack\.Protected guard=\{Boolean\(account && hasMobileAccess\(capabilities\)\)\}>/,
  );
  assert.match(layout, /<Stack\.Protected guard=\{!account \|\| !capabilities\}>/);
});

test('Expo uses its default Babel setup and TypeScript resolves aliases to src', () => {
  const tsconfig = JSON.parse(read('../tsconfig.json'));
  assert.equal(existsSync(new URL('../babel.config.js', import.meta.url)), false);
  assert.deepEqual(tsconfig.compilerOptions.paths['@/*'], ['./src/*']);
  const manifest = JSON.parse(read('../package.json'));
  assert.equal(manifest.devDependencies['babel-plugin-module-resolver'], undefined);
});

test('Mobile uses OVRANTO v2 native semantic tokens through one shared adapter', () => {
  const theme = read('../src/shared/config/theme.ts');
  const packageJson = JSON.parse(read('../package.json'));
  assert.ok(theme.includes('@gym/design-tokens/ovranto-native'));
  assert.equal(packageJson.dependencies['@gym/design-tokens'], 'workspace:*');
  for (const mapping of [
    'background: tokens.background',
    'surface: tokens.card',
    'text: tokens.foreground',
    'muted: tokens.mutedForeground',
    'primary: tokens.primary',
    'primaryForeground: tokens.primaryForeground',
    'border: tokens.border',
    'error: tokens.destructive',
  ]) {
    assert.ok(theme.includes(mapping), mapping);
  }
});

test('UniWind light and dark channels match generated OVRANTO semantic tokens', () => {
  const css = read('../global.css');
  const layout = read('../src/app/_layout.tsx');
  const rgb = (hex) => {
    let value = hex.slice(1);
    if (value.length === 3)
      value = value
        .split('')
        .map((part) => part + part)
        .join('');
    return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16)).join(' ');
  };
  const kebab = (key) =>
    key.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase()).replace(/([a-z])(\d)/g, '$1-$2');
  for (const mode of ['light', 'dark']) {
    const content = css.split('  .' + mode + ' {')[1]?.split('  }')[0];
    assert.ok(content, 'Missing ' + mode + ' UniWind theme');
    const palette = ovrantoNativePalette[mode];
    for (const [key, value] of Object.entries(palette)) {
      assert.ok(content.includes('--' + kebab(key) + ': ' + rgb(value) + ';'), mode + ' ' + key);
    }
    for (const [key, value] of Object.entries(ovrantoNativePalette.brand)) {
      assert.ok(content.includes('--brand-' + key + ': ' + rgb(value) + ';'));
    }
  }
  assert.ok(layout.includes('<GluestackUIProvider mode={preference}>'));
  assert.ok(layout.includes("<StatusBar style={mode === 'dark' ? 'light' : 'dark'} />"));
  assert.ok(layout.includes('<MobileThemeProvider>'));
});
