import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mobileDiagnostics } from '@/shared/diagnostics/mobile-diagnostics';
import { MobileErrorBoundary } from '@/shared/ui/mobile-error-boundary';

function Child({ fail }: { fail: boolean }) {
  if (fail) throw new Error('secret: private API payload');
  return <Text>Екран відновлено</Text>;
}

describe('MobileErrorBoundary (native)', () => {
  afterEach(() => {
    mobileDiagnostics.disable();
    vi.restoreAllMocks();
  });

  it('renders children when no exception occurs', async () => {
    const view = await render(
      <MobileErrorBoundary>
        <Child fail={false} />
      </MobileErrorBoundary>,
    );
    expect(view.getByText('Екран відновлено')).toBeTruthy();
    expect(view.queryByTestId('mobile-error-fallback')).toBeNull();
  });

  it('hides exception details and offers an explicit retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const sink = vi.fn();
    mobileDiagnostics.configure({ environment: 'preview', permissionGranted: true, sink });
    const view = await render(
      <MobileErrorBoundary>
        <Child fail />
      </MobileErrorBoundary>,
    );

    expect(view.getByText('Виникла помилка інтерфейсу')).toBeTruthy();
    expect(view.queryByText('secret: private API payload')).toBeNull();
    expect(sink).toHaveBeenCalledExactlyOnceWith(
      { version: 1, kind: 'render_failure' },
      expect.any(AbortSignal),
    );
    view.rerender(
      <MobileErrorBoundary>
        <Child fail={false} />
      </MobileErrorBoundary>,
    );
    await fireEvent.press(view.getByTestId('mobile-error-retry'));
    expect(view.getByText('Екран відновлено')).toBeTruthy();
  });
});
