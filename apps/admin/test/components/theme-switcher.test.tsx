import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

import { ThemeSwitcher } from '../../src/shared/ui/theme-switcher';
import { parseThemePreference } from '../../src/shared/lib/theme-preference';

const labels = { title: 'Interface theme', system: 'System', light: 'Light', dark: 'Dark' };

beforeEach(() => {
  refresh.mockClear();
  document.documentElement.classList.remove('light', 'dark');
});

afterEach(cleanup);

describe('Admin theme preference', () => {
  it('defaults unknown cookie values to system', () => {
    expect(parseThemePreference(undefined)).toBe('system');
    expect(parseThemePreference('unknown')).toBe('system');
    expect(parseThemePreference('light')).toBe('light');
    expect(parseThemePreference('dark')).toBe('dark');
  });

  it('offers accessible light, dark and OS preference and refreshes server state', () => {
    render(<ThemeSwitcher initialTheme="system" labels={labels} />);
    const select = screen.getByRole('combobox', { name: 'Interface theme' });
    expect(screen.getAllByRole('option')).toHaveLength(3);

    fireEvent.change(select, { target: { value: 'dark' } });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(refresh).toHaveBeenCalledOnce();

    fireEvent.change(select, { target: { value: 'system' } });
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.classList.contains('light')).toBe(false);
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
