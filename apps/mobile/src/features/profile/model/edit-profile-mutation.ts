import { onlineManager, useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/model/auth-context';
import { accountQueryKeys } from '@/shared/api/query-client';
import { profilePatch, type EditProfileValues } from '../lib/edit-profile-schema';

export function useEditProfile() {
  const { account, getApi, signOut } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: EditProfileValues) => {
      if (!onlineManager.isOnline()) throw new Error('Немає мережі. Профіль не збережено.');
      const api = getApi();
      if (!api || !account) throw new Error('Немає доступу до API.');
      const response = await api.PATCH('/users/me', { body: profilePatch(values) });
      if (response.response.status === 401) {
        await signOut();
        throw new Error('Сесію завершено.');
      }
      if (response.response.status !== 200 || !response.data) {
        throw new Error('Не вдалося оновити профіль.');
      }
      return response.data;
    },
    onSuccess: (updated) => {
      if (!account) return;
      // PATCH /users/me returns the verified account; show changes immediately
      // even when the profile screen's GET query is inactive during editing.
      queryClient.setQueryData(accountQueryKeys.me(account.id), updated);
      void queryClient.invalidateQueries({ queryKey: accountQueryKeys.me(account.id) });
    },
    networkMode: 'always',
    retry: false,
  });
}
