import type { ReactNode } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { HomeScreen } from '../../src/widgets/home/ui/home-screen';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

afterEach(cleanup);

test('homepage explains the process and labels design previews honestly', () => {
  render(<HomeScreen />);
  expect(screen.getByRole('heading', { name: 'Від плану до наступного результату' })).toBeTruthy();
  expect(screen.getByText(/не реальні дані спортсмена/)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Переглянути продукти' }).getAttribute('href')).toBe(
    '/apps',
  );
});
