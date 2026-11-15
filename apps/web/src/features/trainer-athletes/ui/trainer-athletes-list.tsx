'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import {
  trainerAthleteListQueryOptions,
  TrainerAthleteListRequestError,
} from '../api/trainer-athlete-list-query';
import { trainerAthleteQueryKeys } from '../lib/trainer-athlete-query-keys';
import { Button } from '@/shared/ui/button';
import { InviteRelationshipForm } from './invite-relationship-form';
import { RelationshipActions } from './relationship-actions';
import {
  formatTrainerAthleteDate,
  getRelationshipContact,
  getTrainerAthleteInvitationLabel,
  getTrainerAthleteListErrorMessage,
  getTrainerAthleteStatusLabel,
  searchTrainerAthletesOnPage,
  TRAINER_ATHLETE_FILTERS,
  type TrainerAthleteFilter,
  type TrainerAthleteListItem,
} from '../lib/trainer-athletes-list';

type ListState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready';
      relationships: TrainerAthleteListItem[];
      total: number;
      pages: number;
    };

export function TrainerAthletesList({
  actorId,
  actorRole,
}: {
  actorId: string;
  actorRole: 'TRAINER' | 'ATHLETE';
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const redirecting = useRef(false);
  const [filter, setFilter] = useState<TrainerAthleteFilter>('ALL');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const query = useQuery(trainerAthleteListQueryOptions(actorId, actorRole, filter, page));
  const unauthenticated =
    query.error instanceof TrainerAthleteListRequestError && query.error.status === 401;

  useEffect(() => {
    if (unauthenticated && !redirecting.current) {
      redirecting.current = true;
      queryClient.clear();
      router.replace('/login');
    }
  }, [unauthenticated, queryClient, router]);

  function chooseStatus(next: TrainerAthleteFilter) {
    setFilter(next);
    setPage(1);
    setSearch('');
  }

  function changePage(next: number) {
    setPage(next);
    setSearch('');
  }

  function refreshRelationships() {
    void queryClient.invalidateQueries({ queryKey: trainerAthleteQueryKeys.lists() });
  }

  function inviteCreated() {
    // The invitation mutation already invalidated every list without refetching
    // the old filter; only refresh when PENDING is already the active key.
    if (filter === 'PENDING' && page === 1) {
      void query.refetch();
    }
    setFilter('PENDING');
    setPage(1);
    setSearch('');
  }

  function retry() {
    void query.refetch();
  }

  let state: ListState;
  if (query.isPending || unauthenticated) {
    state = { kind: 'loading' };
  } else if (query.isError) {
    state = {
      kind: 'error',
      message:
        query.error instanceof TrainerAthleteListRequestError
          ? query.error.message
          : getTrainerAthleteListErrorMessage(),
    };
  } else {
    state = {
      kind: 'ready',
      relationships: query.data.relationships,
      total: query.data.total,
      pages: query.data.pages,
    };
  }

  // Do not render cached relationship data after an authentication failure.
  if (unauthenticated) return null;

  const visible =
    state.kind === 'ready'
      ? searchTrainerAthletesOnPage(state.relationships, search, actorRole)
      : [];

  return (
    <main className="mx-auto max-w-5xl space-y-7 px-6 py-12">
      <header className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          {actorRole === 'TRAINER' ? 'Кабінет тренера' : 'Кабінет атлета'}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {actorRole === 'TRAINER' ? 'Мої підопічні' : 'Мої тренери'}
        </h1>
        <p className="text-sm text-muted-foreground">
          Переглядайте запрошення, активні відносини та історію співпраці.
        </p>
      </header>

      <InviteRelationshipForm actorId={actorId} actorRole={actorRole} onCreated={inviteCreated} />

      <section
        className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2"
        aria-label="Фільтри підопічних"
      >
        <div className="space-y-2">
          <label htmlFor="trainer-athletes-status" className="block text-sm font-medium">
            Статус відносин
          </label>
          <select
            id="trainer-athletes-status"
            value={filter}
            onChange={(event) => chooseStatus(event.target.value as TrainerAthleteFilter)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {TRAINER_ATHLETE_FILTERS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="trainer-athletes-search" className="block text-sm font-medium">
            Пошук контакту на поточній сторінці
          </label>
          <input
            id="trainer-athletes-search"
            type="search"
            value={search}
            maxLength={254}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Email співрозмовника"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Пошук працює серед завантажених записів. Для завершених відносин контактні дані можуть
            бути приховані.
          </p>
        </div>
      </section>

      {state.kind === 'loading' && (
        <p className="rounded-xl border bg-card p-6 text-muted-foreground" role="status">
          Завантажуємо підопічних…
        </p>
      )}

      {state.kind === 'error' && (
        <section className="space-y-3 rounded-xl border bg-card p-6" role="alert">
          <p className="text-sm text-destructive">{state.message}</p>
          <Button type="button" variant="outline" onClick={retry}>
            Спробувати ще раз
          </Button>
        </section>
      )}

      {state.kind === 'ready' && (
        <>
          <p className="text-sm text-muted-foreground" role="status">
            Усього за обраним статусом: {state.total}
          </p>
          {state.relationships.length === 0 ? (
            <section className="space-y-2 rounded-xl border bg-card p-6">
              <h2 className="font-semibold">Підопічних не знайдено</h2>
              <p className="text-sm text-muted-foreground">
                {filter === 'ALL'
                  ? 'Відносин з атлетами поки немає.'
                  : 'За цим статусом записів немає. Спробуйте інший фільтр.'}
              </p>
            </section>
          ) : visible.length === 0 ? (
            <section className="space-y-2 rounded-xl border bg-card p-6">
              <h2 className="font-semibold">Немає збігів на цій сторінці</h2>
              <p className="text-sm text-muted-foreground">
                Змініть пошуковий запит або перейдіть на іншу сторінку.
              </p>
            </section>
          ) : (
            <section className="grid gap-4 sm:grid-cols-2" aria-label="Список підопічних">
              {visible.map((relationship) => {
                const email = getRelationshipContact(relationship, actorRole);
                return (
                  <article
                    key={relationship.id}
                    className="space-y-3 rounded-xl border bg-card p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h2 className="font-semibold">
                        {email ?? 'Користувач (контакти приховані)'}
                      </h2>
                      <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                        {getTrainerAthleteStatusLabel(relationship.status)}
                      </span>
                    </div>
                    <dl className="space-y-2 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Запрошення</dt>
                        <dd className="text-right">
                          {getTrainerAthleteInvitationLabel(relationship, relationship.trainerId)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Створено</dt>
                        <dd>{formatTrainerAthleteDate(relationship.createdAt)}</dd>
                      </div>
                      {relationship.respondedAt && (
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">Відповідь</dt>
                          <dd>{formatTrainerAthleteDate(relationship.respondedAt)}</dd>
                        </div>
                      )}
                      {relationship.endedAt && (
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">Завершено</dt>
                          <dd>{formatTrainerAthleteDate(relationship.endedAt)}</dd>
                        </div>
                      )}
                    </dl>
                    <RelationshipActions
                      relationship={relationship}
                      actorId={actorId}
                      onUpdated={refreshRelationships}
                    />
                  </article>
                );
              })}
            </section>
          )}
          {state.pages > 1 && (
            <nav
              aria-label="Сторінки підопічних"
              className="flex items-center justify-between gap-4"
            >
              <Button
                type="button"
                variant="outline"
                disabled={page <= 1}
                onClick={() => changePage(page - 1)}
              >
                Назад
              </Button>
              <span className="text-sm text-muted-foreground">
                Сторінка {page} із {state.pages}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={page >= state.pages}
                onClick={() => changePage(page + 1)}
              >
                Далі
              </Button>
            </nav>
          )}
        </>
      )}
    </main>
  );
}
