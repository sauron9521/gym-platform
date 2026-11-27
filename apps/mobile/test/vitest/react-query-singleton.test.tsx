import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

test('renders TanStack Query hooks with the Expo React singleton', () => {
  const client = new QueryClient();
  function Probe() {
    return (
      <Text>{useQueryClient() === client ? 'same query context' : 'wrong query context'}</Text>
    );
  }
  render(
    <QueryClientProvider client={client}>
      <Probe />
    </QueryClientProvider>,
  );
  expect(screen.getByText('same query context')).toBeTruthy();
});
