'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { webApi } from '@/shared/api/client';
import { useAuthFailure } from '@/shared/api/use-auth-failure';

import { getProfileErrorMessage, type ProfilePatch } from '../lib/profile-form';
import { profileQueryKeys } from '../lib/profile-query-keys';

export class ProfileMutationError extends Error {
  constructor(readonly status?: number) {
    super(
      status === undefined
        ? 'Немає з’єднання з API. Спробуйте пізніше.'
        : getProfileErrorMessage(status),
    );
    this.name = 'ProfileMutationError';
  }
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  const onError = useAuthFailure();

  return useMutation<void, ProfileMutationError, ProfilePatch>({
    mutationFn: async (body) => {
      try {
        const { response } = await webApi.PATCH('/users/me', { body });
        if (response.status !== 200) {
          throw new ProfileMutationError(response.status);
        }
      } catch (error) {
        if (error instanceof ProfileMutationError) throw error;
        throw new ProfileMutationError();
      }
    },
    onSuccess: async () => {
      const queryKey = profileQueryKeys.me();
      await queryClient.cancelQueries({ queryKey, exact: true });
      await queryClient.invalidateQueries({
        queryKey,
        exact: true,
        // The editor explicitly refetches after PATCH and resets the form
        // from canonical GET data. Avoid a redundant automatic request.
        refetchType: 'none',
      });
    },
    onError,
    retry: false,
  });
}
