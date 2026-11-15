'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { useInviteRelationshipMutation } from '../api/trainer-athlete-mutations';
import { Button } from '@/shared/ui/button';
import { invitationSchema, type InvitationValues } from '../lib/trainer-athlete-actions';

export function InviteRelationshipForm({
  actorId,
  actorRole,
  onCreated,
}: {
  actorId: string;
  actorRole: 'ATHLETE' | 'TRAINER';
  onCreated: () => void;
}) {
  const mutation = useInviteRelationshipMutation();
  const form = useForm<InvitationValues>({
    resolver: zodResolver(invitationSchema),
    defaultValues: { userId: '' },
    mode: 'onBlur',
  });

  async function submit(values: InvitationValues) {
    if (values.userId === actorId) {
      form.setError('userId', { message: 'Не можна запросити самого себе.' });
      return;
    }

    mutation.reset();
    try {
      await mutation.mutateAsync(values.userId);
      form.reset();
      onCreated();
    } catch {
      // The mutation owns safe error messages and handles 401 redirects.
    }
  }

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5" aria-label="Нове запрошення">
      <h2 className="text-lg font-semibold">
        {actorRole === 'TRAINER' ? 'Запросити атлета' : 'Запросити тренера'}
      </h2>
      <p className="text-sm text-muted-foreground">
        Для створення запрошення потрібен ID користувача (UUID), а не його email. Передайте свій ID
        партнеру або попросіть його ID.
      </p>
      <div className="space-y-1">
        <p className="text-sm font-medium">Ваш ID</p>
        <code className="block break-all rounded-md bg-muted px-3 py-2 text-sm">{actorId}</code>
      </div>
      <form onSubmit={form.handleSubmit(submit)} noValidate className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="relationship-target-id" className="block text-sm font-medium">
            ID {actorRole === 'TRAINER' ? 'атлета' : 'тренера'}
          </label>
          <input
            id="relationship-target-id"
            type="text"
            autoComplete="off"
            spellCheck={false}
            disabled={mutation.isPending || form.formState.isSubmitting}
            aria-invalid={Boolean(form.formState.errors.userId)}
            {...form.register('userId')}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
          {form.formState.errors.userId && (
            <p role="alert" className="text-xs text-destructive">
              {form.formState.errors.userId.message}
            </p>
          )}
        </div>
        {mutation.isError && mutation.error.status !== 401 && (
          <p role="alert" className="text-sm text-destructive">
            {mutation.error.message}
          </p>
        )}
        <Button type="submit" disabled={mutation.isPending || form.formState.isSubmitting}>
          {mutation.isPending ? 'Надсилаємо…' : 'Надіслати запрошення'}
        </Button>
      </form>
    </section>
  );
}
