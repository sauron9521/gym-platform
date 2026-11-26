import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RestTimer } from '@/features/workouts/ui/rest-timer';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RestTimer (native)', () => {
  it('applies a hydrated default before use and keeps an in-workout override', async () => {
    const view = await render(<RestTimer />);
    await view.rerender(<RestTimer defaultDuration={120} />);
    expect(view.getByText('02:00')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: '60 секунд' }));
    await view.rerender(<RestTimer defaultDuration={90} />);
    expect(view.getByText('01:00')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Старт' }));
    expect(view.getByRole('button', { name: 'Пауза' })).toBeTruthy();
  });

  it('does not restart an active timer when the default changes', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(100000);
    const view = await render(
      <RestTimer defaultDuration={120} autoStart={{ sequence: 1, startedAt: 100000 }} />,
    );
    expect(view.getByText('02:00')).toBeTruthy();
    clock.mockReturnValue(110000);
    await view.rerender(
      <RestTimer defaultDuration={60} autoStart={{ sequence: 1, startedAt: 100000 }} />,
    );
    await fireEvent.press(view.getByRole('button', { name: 'Пауза' }));
    expect(view.getByText('01:50')).toBeTruthy();
  });

  it('offers 60/90/120 presets, pause/resume and reset', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(100000);
    const view = await render(<RestTimer />);
    expect(view.getByText('01:30')).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: '120 секунд' }));
    expect(view.getByText('02:00')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Старт' }));
    expect(view.getByRole('button', { name: '60 секунд', disabled: true })).toBeTruthy();

    clock.mockReturnValue(165000);
    await fireEvent.press(view.getByRole('button', { name: 'Пауза' }));
    expect(view.getByText('00:55')).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: 'Продовжити' }));
    expect(view.getByRole('button', { name: 'Пауза' })).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: 'Скинути' }));
    expect(view.getByText('02:00')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Старт' })).toBeTruthy();
  });

  it('restarts the full preset when the previous deadline has elapsed', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(10000);
    const view = await render(<RestTimer />);

    await fireEvent.press(view.getByRole('button', { name: '60 секунд' }));
    await fireEvent.press(view.getByRole('button', { name: 'Старт' }));

    clock.mockReturnValue(71000);
    await fireEvent.press(view.getByRole('button', { name: 'Пауза' }));
    expect(view.getByText('00:00')).toBeTruthy();

    await fireEvent.press(view.getByRole('button', { name: 'Старт' }));
    expect(view.getByText('01:00')).toBeTruthy();
  });

  it('reconciles the deadline on returning from background without server requests', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(10000);
    let change: ((status: AppStateStatus) => void) | undefined;
    vi.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      change = listener as (status: AppStateStatus) => void;
      return { remove: vi.fn() } as ReturnType<typeof AppState.addEventListener>;
    });

    const view = await render(<RestTimer />);
    await fireEvent.press(view.getByRole('button', { name: 'Старт' }));
    expect(change).toBeDefined();

    await act(async () => {
      change?.('background');
    });
    clock.mockReturnValue(55000);
    await act(async () => {
      change?.('active');
    });
    await waitFor(() => expect(view.getByText('00:45')).toBeTruthy());
  });
  it('auto-starts selected preset only for a new confirmation event', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(100000);
    const view = await render(<RestTimer />);
    await fireEvent.press(view.getByRole('button', { name: '60 секунд' }));
    await view.rerender(<RestTimer autoStart={{ sequence: 1, startedAt: 100000 }} />);
    expect(view.getByRole('button', { name: 'Пауза' })).toBeTruthy();
    clock.mockReturnValue(110000);
    await fireEvent.press(view.getByRole('button', { name: 'Пауза' }));
    expect(view.getByText('00:50')).toBeTruthy();
    await view.rerender(<RestTimer autoStart={{ sequence: 1, startedAt: 100000 }} />);
    expect(view.getByRole('button', { name: 'Продовжити' })).toBeTruthy();
    await view.rerender(<RestTimer autoStart={{ sequence: 2, startedAt: 110000 }} />);
    expect(view.getByText('01:00')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Пауза' })).toBeTruthy();
  });
});
