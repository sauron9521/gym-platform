import { queryOptions } from '@tanstack/react-query';

import { webApi } from '@/shared/api/client';

import { getProfileErrorMessage } from '../lib/profile-form';
import { profileQueryKeys } from '../lib/profile-query-keys';

export class ProfileRequestError extends Error {
  constructor(readonly status?: number) {
    super(
      status === undefined
        ? 'Немає з’єднання з API. Спробуйте пізніше.'
        : getProfileErrorMessage(status),
    );
    this.name = 'ProfileRequestError';
  }
}

export function profileQueryOptions() {
  return queryOptions({
    queryKey: profileQueryKeys.me(),
    queryFn: async ({ signal }) => {
      try {
        const { response, data } = await webApi.GET('/users/me', { signal });
        if (response.status !== 200 || !data) {
          throw new ProfileRequestError(response.status);
        }
        return data;
      } catch (error) {
        if (error instanceof ProfileRequestError || signal.aborted) throw error;
        throw new ProfileRequestError();
      }
    },
    retry: false,
  });
}
