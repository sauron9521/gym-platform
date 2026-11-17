import type { ReactNode } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';

import { IntroPage } from '../../src/widgets/content/ui/intro-page';

vi.mock('next/link', () => ({
  default: function LinkStub({ href, children }: { href: string; children: ReactNode }) {
    return <a href={href}>{children}</a>;
  },
}));

afterEach(cleanup);

test('product pages present grounded capabilities and useful internal navigation', () => {
  render(
    <IntroPage
      eyebrow="Web"
      title="Web застосунок"
      description="Знайомство з можливостями."
      features={[
        { title: 'Каталог вправ', description: 'Каталог доступних вправ.' },
        { title: 'Мої тренування', description: 'Планування тренувань.' },
      ]}
      nextLink={{ href: '/features', label: 'Усі можливості' }}
    />,
  );
  const section = screen.getByRole('region', { name: 'Можливості продукту' });
  expect(within(section).getAllByRole('listitem')).toHaveLength(2);
  expect(within(section).getByRole('link', { name: 'Усі можливості' })).toBeTruthy();
  expect(screen.queryByText(/Цей розділ готується/)).toBeNull();
});

test('informational pages without a feature inventory preserve their placeholder', () => {
  render(<IntroPage eyebrow="Про нас" title="Про платформу" description="Інформація." />);
  expect(screen.getByText(/Цей розділ готується/)).toBeTruthy();
});
