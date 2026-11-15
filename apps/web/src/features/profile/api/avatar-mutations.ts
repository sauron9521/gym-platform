'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuthFailure } from '@/shared/api/use-auth-failure';

import { avatarErrorMessage } from '../lib/avatar';
import { profileQueryKeys } from '../lib/profile-query-keys';

export type AvatarMutationInput =
  | { action: 'upload'; file: File }
  | { action: 'delete' };

export class AvatarMutationError extends Error {
  constructor(readonly status?: number) {
    super(
      status === undefined
        ? 'Немає з’єднання з API. Спробуйте пізніше.'
        : avatarErrorMessage(status),
    );
    this.name = 'AvatarMutationError';
  }
}

export function useAvatarMutation() {
  const queryClient = useQueryClient();
  const onError = useAuthFailure();

  return useMutation<void, AvatarMutationError, AvatarMutationInput>({
    mutationFn: async (input) => {
      try {
        const form = new FormData();
        if (input.action === 'upload') form.append('file', input.file);

        // Keep multipart boundaries browser-managed; the JSON API client
        // cannot be used for the binary upload endpoint.
        const response = await fetch('/backend/users/me/avatar', {
          method: input.action === 'upload' ? 'POST' : 'DELETE',
          credentials: 'include',
          body: input.action === 'upload' ? form : undefined,
        });
        if (response.status !== 200) {
          throw new AvatarMutationError(response.status);
        }
      } catch (error) {
        if (error instanceof AvatarMutationError) throw error;
        throw new AvatarMutationError();
      }
    },
    onSuccess: async () => {
      const queryKey = profileQueryKeys.me();
      await queryClient.cancelQueries({ queryKey, exact: true });
      // The component explicitly re-reads canonical /users/me once after
      // upload/delete. Do not issue a second background request here.
      await queryClient.invalidateQueries({
        queryKey,
        exact: true,
        refetchType: 'none',
      });
    },
    onError,
    retry: false,
  });
}
