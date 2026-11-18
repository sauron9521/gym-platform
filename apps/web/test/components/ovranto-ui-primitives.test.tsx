import { createElement } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { Button, Card, CardContent, CardDescription, CardTitle, Input } from '@gym/ui-web';

afterEach(cleanup);

test('button retains native disabled behavior and visible keyboard focus', () => {
  const onClick = vi.fn();
  const { container } = render(createElement(Button, { disabled: true, onClick }, 'Зберегти'));
  const button = screen.getByRole('button', { name: 'Зберегти' });

  expect((button as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(button);
  expect(onClick).not.toHaveBeenCalled();
  expect(button.getAttribute('data-slot')).toBe('button');
  expect(button.className).toContain('rounded-lg');
  expect(button.className).toContain('focus-visible:ring-offset-2');
  expect(button.className).toContain('motion-reduce:transition-none');
  expect(container.querySelectorAll('button')).toHaveLength(1);
});

test('button supports opt-in touch sizes and existing asChild navigation', () => {
  const { rerender } = render(createElement(Button, { size: 'touch' }, 'Почати тренування'));
  const touchButton = screen.getByRole('button', { name: 'Почати тренування' });
  expect(touchButton.className).toContain('h-11');

  rerender(
    createElement(
      Button,
      { asChild: true, variant: 'outline' },
      createElement('a', { href: 'https://example.test/workouts' }, 'Усі тренування'),
    ),
  );
  const link = screen.getByRole('link', { name: 'Усі тренування' });
  expect(link.getAttribute('href')).toBe('https://example.test/workouts');
  expect(link.className).toContain('border-input');

  rerender(createElement(Button, { size: 'iconTouch', 'aria-label': 'Додати підхід' }, '+'));
  const iconButton = screen.getByRole('button', { name: 'Додати підхід' });
  expect(iconButton.className).toContain('size-11');
});

test('input styling honors native invalid and disabled semantics', () => {
  render(
    createElement(
      'div',
      null,
      createElement('label', { htmlFor: 'kg' }, 'Вага, кг'),
      createElement(Input, {
        id: 'kg',
        'aria-invalid': true,
        'aria-describedby': 'weight-error',
        disabled: true,
      }),
      createElement('p', { id: 'weight-error' }, 'Перевірте вагу'),
    ),
  );
  const input = screen.getByRole('textbox', { name: 'Вага, кг' }) as HTMLInputElement;
  expect(input.disabled).toBe(true);
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(input.getAttribute('aria-describedby')).toBe('weight-error');
  expect(input.className).toContain('aria-invalid:border-destructive');
  expect(input.className).toContain('focus-visible:ring-ring/30');
  expect(input.className).toContain('rounded-lg');
});

test('card remains a semantic slot-based surface with restrained shadow', () => {
  const { container } = render(
    createElement(
      Card,
      { 'aria-label': 'Тренування' },
      createElement(CardTitle, null, 'Силова сесія'),
      createElement(CardDescription, null, 'Чотири підходи'),
      createElement(CardContent, null, 'Програма'),
    ),
  );
  const card = container.querySelector('[data-slot="card"]');
  const title = screen.getByRole('heading', { level: 3, name: 'Силова сесія' });
  const description = container.querySelector('[data-slot="card-description"]');
  const body = container.querySelector('[data-slot="card-content"]');

  expect(card?.className).toContain('rounded-lg');
  expect(card?.className).toContain('border-border');
  expect(card?.className).toContain('shadow-sm');
  expect(title).toBeTruthy();
  expect(description?.tagName).toBe('P');
  expect(body?.textContent).toBe('Програма');
});
