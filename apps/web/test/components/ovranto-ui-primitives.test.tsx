import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { Button, Card, CardContent, CardDescription, CardTitle, Input } from '@gym/ui-web';

afterEach(cleanup);

test('button retains native disabled behavior and visible keyboard focus', () => {
  const onClick = vi.fn();
  const { container } = render(
    <Button disabled onClick={onClick}>
      Зберегти
    </Button>,
  );
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
  const { rerender } = render(<Button size="touch">Почати тренування</Button>);
  expect(screen.getByRole('button', { name: 'Почати тренування' }).className).toContain(
    'h-11',
  );
  rerender(
    <Button asChild variant="outline">
      <a href="/workouts">Усі тренування</a>
    </Button>,
  );
  const link = screen.getByRole('link', { name: 'Усі тренування' });
  expect(link.getAttribute('href')).toBe('/workouts');
  expect(link.className).toContain('border-input');
  rerender(
    <Button size="iconTouch" aria-label="Додати підхід">
      +
    </Button>,
  );
  expect(screen.getByRole('button', { name: 'Додати підхід' }).className).toContain('size-11');
});

test('input styling honors native invalid and disabled semantics', () => {
  render(
    <div>
      <label htmlFor="kg">Вага, кг</label>
      <Input id="kg" aria-invalid={true} aria-describedby="weight-error" disabled />
      <p id="weight-error">Перевірте вагу</p>
    </div>,
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
    <Card aria-label="Тренування">
      <CardTitle>Силова сесія</CardTitle>
      <CardDescription>Чотири підходи</CardDescription>
      <CardContent>Програма</CardContent>
    </Card>,
  );
  const card = container.querySelector('[data-slot="card"]');
  expect(card?.className).toContain('rounded-lg');
  expect(card?.className).toContain('border-border');
  expect(card?.className).toContain('shadow-sm');
  expect(screen.getByRole('heading', { level: 3, name: 'Силова сесія' })).toBeTruthy();
  expect(container.querySelector('[data-slot="card-description"]')?.tagName).toBe('P');
  expect(container.querySelector('[data-slot="card-content"]')?.textContent).toBe('Програма');
});
