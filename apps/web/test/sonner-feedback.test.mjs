import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('one app-level Sonner toaster is mounted within the browser provider', async () => {
  const provider = await readFile(new URL('../src/app/providers.tsx', import.meta.url), 'utf8');
  const toaster = await readFile(
    new URL('../src/shared/ui/web-toaster.tsx', import.meta.url),
    'utf8',
  );
  const root = await readFile(new URL('../src/app/layout.tsx', import.meta.url), 'utf8');
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

  assert.equal(manifest.dependencies.sonner, '2.0.8');
  assert.match(provider, /<QueryClientProvider client=\{queryClient\}>/);
  assert.match(provider, /<WebToaster \/>/);
  assert.match(root, /<WebQueryProvider>/);
  assert.match(toaster, /import \{ Toaster \} from 'sonner'/);
  assert.match(toaster, /position="top-right"/);
  assert.match(toaster, /closeButton/);
  assert.match(toaster, /visibleToasts=\{3\}/);
});

test('workout success notifications fire only after successful mutations', async () => {
  const create = await readFile(
    new URL('../src/features/workouts/ui/create-workout-form.tsx', import.meta.url),
    'utf8',
  );
  const edit = await readFile(
    new URL('../src/features/workouts/ui/edit-workout-form.tsx', import.meta.url),
    'utf8',
  );
  const actions = await readFile(
    new URL('../src/features/workouts/ui/workout-actions.tsx', import.meta.url),
    'utf8',
  );

  for (const source of [create, edit, actions]) {
    assert.match(source, /import \{ toast \} from 'sonner'/);
    assert.match(source, /toast.success\(/);
    assert.doesNotMatch(source, /toast.error\(/);
    assert.match(source, /mutation.mutateAsync/);
    assert.doesNotMatch(source, /localStorage|sessionStorage|document.cookie/);
  }
  assert.match(create, /toast.success\('Тренування створено.'\)/);
  assert.match(edit, /toast.success\('Зміни тренування збережено.'\)/);
  assert.match(actions, /'Тренування розпочато.'/);
  assert.match(actions, /'Тренування завершено.'/);
  assert.match(actions, /'Тренування скасовано.'/);
  // Field validation and conflict errors keep their nearby actionable messages.
  assert.match(create, /form.formState.errors.title/);
  assert.match(edit, /mutation.isError/);
  assert.match(actions, /mutation.isError/);
});
