import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';

import { ApplicationDetail } from '../../src/widgets/applications/ui/application-detail';
import WebApplicationPage from '../../src/app/apps/web/page';
import MobileApplicationPage from '../../src/app/apps/mobile/page';

vi.mock('next/link', () => ({
  default: function LinkStub({ href, children }: { href: string; children: ReactNode }) {
    return <a href={href}>{children}</a>;
  },
}));

afterEach(cleanup);

describe('Landing Web and Mobile feature showcases', () => {
  it('describes concrete Web capabilities with headings and safe internal navigation', () => {
    render(<WebApplicationPage />);
    const region = screen.getByRole('region', { name: 'Ключові можливості' });
    expect(within(region).getAllByRole('listitem')).toHaveLength(4);
    expect(within(region).getByRole('heading', { name: 'Каталог вправ' })).toBeTruthy();
    expect(within(region).getByRole('heading', { name: 'Програми та тренування' })).toBeTruthy();
    expect(screen.getByText('Статус: у розробці')).toBeTruthy();
    const cta = screen.getByRole('region', { name: 'Що дослідити далі?' });
    const ctaLinks = within(cta).getAllByRole('link');
    expect(ctaLinks[0].getAttribute('href')).toBe('/for-athletes');
    expect(ctaLinks[1].getAttribute('href')).toBe('/apps/mobile');
    const athleteLink = screen.getByRole('link', { name: 'Можливості для спортсменів' });
    expect(athleteLink.getAttribute('href')).toBe('/for-athletes');
    expect(screen.getByRole('link', { name: 'Про Athlete Mobile' }).getAttribute('href')).toBe(
      '/apps/mobile',
    );
  });

  it('explains mobile progress without claiming that full offline mode is live', () => {
    render(<MobileApplicationPage />);
    const region = screen.getByRole('region', { name: 'Ключові можливості' });
    expect(within(region).getAllByRole('listitem')).toHaveLength(4);
    expect(within(region).getByRole('heading', { name: 'Прогрес' })).toBeTruthy();
    expect(screen.getByText(/повний офлайн-режим ще в розробці/)).toBeTruthy();
    const athleteLink = screen.getByRole('link', { name: 'Можливості для спортсменів' });
    expect(athleteLink.getAttribute('href')).toBe('/for-athletes');
    const alternateProduct = screen.getByRole('link', { name: 'Про Athlete Web' });
    expect(alternateProduct.getAttribute('href')).toBe('/apps/web');
  });

  it('preserves the generic development and screenshot disclosures', () => {
    render(
      <ApplicationDetail
        eyebrow="OVRANTO"
        title="Демонстраційний застосунок"
        description="Публічний запуск не оголошено."
        highlights={[{ title: 'Тренування', description: 'Робота з тренуваннями.' }]}
        audienceLink={{ href: '/for-athletes', label: 'Для спортсменів' }}
        relatedApp={{ href: '/apps/web', label: 'Про Web' }}
      />,
    );
    expect(screen.getByText(/Реальні скриншоти інтерфейсу додамо/)).toBeTruthy();
    expect(screen.getByText(/а не обіцянку доступності/)).toBeTruthy();
    const directoryLink = screen.getByRole('link', { name: 'Продукти OVRANTO' });
    expect(directoryLink.getAttribute('href')).toBe('/apps');
  });
});
