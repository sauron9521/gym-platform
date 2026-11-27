import { test, expect } from 'vitest';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

test('renders TanStack Query hooks with the Expo React singleton', async () => {
  const client = new QueryClient();
  function Probe() {
    return (
      <Text>{useQueryClient() === client ? 'same query context' : 'wrong query context'}</Text>
    );
  }
  const view = await render(
    <QueryClientProvider client={client}>
      <Probe />
    </QueryClientProvider>,
  );
  expect(view.getByText('same query context')).toBeTruthy();
});
