import { useEffect, useMemo, useState } from 'react';
import { Keyboard } from 'react-native';
import { useExercisesQuery } from './exercises-query';

export type ExercisePickerOptions = {
  selectedId: string;
  disabled?: boolean;
  onSelect: (id: string) => void;
};

type RememberedSelection = {
  id: string;
  name: string;
};

/** Coordinates the modal, debounced query and controlled exercise selection. */
export function useExercisePicker({
  selectedId,
  disabled = false,
  onSelect,
}: ExercisePickerOptions) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [remembered, setRemembered] = useState<RememberedSelection | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(input.trim()), 300);
    return () => clearTimeout(timeout);
  }, [input]);

  const query = useExercisesQuery({ search });
  const isSearching = input.trim() !== search;
  const initialError = query.isError && !query.data ? query.error : null;
  const entries = useMemo(() => {
    const seen = new Set<string>();
    return (
      query.data?.pages.flatMap((page) =>
        page.data.filter((exercise) => {
          if (exercise.isArchived || seen.has(exercise.id)) return false;
          seen.add(exercise.id);
          return true;
        }),
      ) ?? []
    );
  }, [query.data]);

  const selectedName = selectedId
    ? (entries.find((exercise) => exercise.id === selectedId)?.name ??
      (remembered?.id === selectedId ? remembered.name : 'Вправу обрано'))
    : null;
  const visibleEntries = isSearching || initialError ? [] : entries;

  const close = () => {
    Keyboard.dismiss();
    setOpen(false);
    setInput('');
    setSearch('');
  };

  const chooseExercise = (id: string, name: string) => {
    if (disabled) return;
    setRemembered({ id, name });
    close();
    onSelect(id);
  };

  const canLoadMore = !isSearching && !query.isPending && !initialError && query.hasNextPage;
  return {
    open,
    input,
    setInput,
    selectedName,
    visibleEntries,
    isSearching,
    initialError,
    query,
    canLoadMore,
    openPicker: () => setOpen(true),
    close,
    chooseExercise,
  };
}
