'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { useRelationshipActionMutation } from '../api/trainer-athlete-mutations';
import { Button } from '@/shared/ui/button';
import {
  endRelationshipSchema,
  getAvailableRelationshipActions,
  RELATIONSHIP_ACTION_LABELS,
  type EndRelationshipValues,
  type RelationshipAction,
} from '../lib/trainer-athlete-actions';
import type { TrainerAthleteListItem } from '../lib/trainer-athletes-list';

export function RelationshipActions({
  relationship,
  actorId,
  onUpdated,
}: {
  relationship: TrainerAthleteListItem;
  actorId: string;
  onUpdated: () => void;
}) {
  const [selected, setSelected] = useState<RelationshipAction | null>(null);
  const mutation = useRelationshipActionMutation();
  const busy = mutation.isPending;
  const form = useForm<EndRelationshipValues>({
    resolver: zodResolver(endRelationshipSchema),
    defaultValues: { reason: '' },
  });

  const allowed = getAvailableRelationshipActions(relationship, actorId);
  if (allowed.length === 0) return null;

  function close() {
    setSelected(null);
    mutation.reset();
    form.reset();
  }

  async function confirm(values: EndRelationshipValues) {
    if (!selected || busy || !allowed.includes(selected)) return;
    mutation.reset();
    try {
      await mutation.mutateAsync({
        id: relationship.id,
        action: selected,
        reason: values.reason.trim() || null,
      });
      close();
    } catch {
      // The mutation exposes a safe error and clears private state on 401.
    }
  }

  return (
    <div className="space-y-3 border-t pt-3">
      <div className="flex flex-wrap gap-2">
        {allowed.map((action) => (
          <Button
            key={action}
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              form.reset();
              mutation.reset();
              setSelected(action);
            }}
          >
            {RELATIONSHIP_ACTION_LABELS[action]}
          </Button>
        ))}
      </div>
      {selected && allowed.includes(selected) && (
        <form
          onSubmit={form.handleSubmit(confirm)}
          noValidate
          className="space-y-3 rounded-lg border p-4"
          aria-label="Підтвердження дії"
        >
          <p className="text-sm font-medium">
            Підтвердити: {RELATIONSHIP_ACTION_LABELS[selected].toLowerCase()}?
          </p>
          {selected === 'terminate' && (
            <p className="text-sm text-muted-foreground">
              Після завершення співпраці доступ до приватних вправ зміниться. Сервер зберігає
              необхідні копії вправ для історичних тренувань.
            </p>
          )}
          {(selected === 'cancel' || selected === 'terminate') && (
            <div className="space-y-1">
              <label htmlFor={`relationship-reason-${relationship.id}`} className="text-sm">
                Причина (необов’язково)
              </label>
              <textarea
                id={`relationship-reason-${relationship.id}`}
                rows={2}
                maxLength={500}
                disabled={busy}
                {...form.register('reason')}
                className="w-full rounded-md border border-input bg-background p-3 text-sm"
              />
              {form.formState.errors.reason && (
                <p className="text-xs text-destructive" role="alert">
                  {form.formState.errors.reason.message}
                </p>
              )}
            </div>
          )}
          {mutation.isError && mutation.error.status !== 401 && (
            <div className="space-y-2" role="alert">
              <p className="text-sm text-destructive">{mutation.error.message}</p>
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onUpdated}>
                Оновити список
              </Button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? 'Виконуємо…' : 'Підтвердити'}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={close}>
              Назад
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
