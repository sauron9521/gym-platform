import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '@gym/ui-web';

afterEach(cleanup);

describe('shared UI primitives as real DOM components', () => {
  test('Button is an accessible native button and handles disabled state', () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Створити</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }));
    expect(onClick).toHaveBeenCalledOnce();

    rerender(<Button onClick={onClick} disabled>Створити</Button>);
    expect(screen.getByRole('button', { name: 'Створити' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Створити' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  test('Button asChild forwards accessible anchor semantics and styling', () => {
    render(<Button asChild variant="outline"><a href="/workouts">Мої тренування</a></Button>);
    const link = screen.getByRole('link', { name: 'Мої тренування' });
    expect(link.getAttribute('href')).toBe('/workouts');
    expect(link.getAttribute('data-slot')).toBe('button');
  });

  test('Input retains standard input accessibility and type', () => {
    render(<label htmlFor="shared-email">Email</label>);
    const { container } = render(
      <Input id="shared-email" type="email" aria-invalid="true" required placeholder="email@example.test" />,
    );
    const input = container.querySelector('input');
    expect(input?.getAttribute('type')).toBe('email');
    expect(input?.getAttribute('aria-invalid')).toBe('true');
    expect(input?.hasAttribute('required')).toBe(true);
    expect(input?.getAttribute('data-slot')).toBe('input');
  });

  test('Card slots preserve content order and semantic headings', () => {
    const { container } = render(
      <Card>
        <CardHeader><CardTitle>Прогрес</CardTitle><CardDescription>За тиждень</CardDescription></CardHeader>
        <CardContent><p>3 тренування</p></CardContent>
      </Card>,
    );
    expect(screen.getByRole('heading', { name: 'Прогрес' }).tagName).toBe('H3');
    expect(screen.getByText('3 тренування')).toBeTruthy();
    expect(container.querySelectorAll('[data-slot]')).toHaveLength(5);
  });
});
