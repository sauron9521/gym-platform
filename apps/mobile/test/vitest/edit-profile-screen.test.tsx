import { ScrollView } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { useEditProfile } from '@/features/profile/model/edit-profile-mutation';
import { useAccountQuery } from '@/features/profile/model/account-query';
import { EditProfileScreen } from '@/screens/profile/ui/edit-profile-screen';

const back = vi.fn();
const mutateAsync = vi.fn();

vi.mock('expo-router', () => ({ useRouter: () => ({ back }) }));
vi.mock('@/features/profile/model/edit-profile-mutation', () => ({
  useEditProfile: vi.fn(),
}));
vi.mock('@/features/profile/model/account-query', () => ({
  useAccountQuery: vi.fn(),
}));

function setup() {
  vi.mocked(useAccountQuery).mockReturnValue({
    data: {
      id: 'user-1',
      profile: {
        displayName: 'Старе ім’я',
        firstName: 'Тест',
        lastName: '',
        height: 193,
        weight: 80,
      },
    },
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useAccountQuery>);
  vi.mocked(useEditProfile).mockReturnValue({
    mutateAsync,
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useEditProfile>);
}

describe('EditProfileScreen (React Native)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutateAsync.mockResolvedValue(undefined);
    setup();
  });

  it('keeps the profile editor keyboard-aware and scrollable', () => {
    const view = render(<EditProfileScreen />);
    const scroll = view.UNSAFE_getAllByType(ScrollView)[0];
    expect(scroll?.props.testID).toBe('profile-edit-scroll');
    expect(scroll?.props).toMatchObject({
      contentInsetAdjustmentBehavior: 'automatic',
      automaticallyAdjustKeyboardInsets: true,
      keyboardShouldPersistTaps: 'handled',
      alwaysBounceVertical: false,
    });
    expect(scroll?.props.contentContainerStyle).toMatchObject({ paddingBottom: 64 });
  });

  it('submits valid localized weight and navigates after success', async () => {
    const view = await render(<EditProfileScreen />);
    await fireEvent.changeText(view.getByTestId('profile-weight'), '82,5');
    await fireEvent.press(view.getByTestId('profile-save'));

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({
        displayName: 'Старе ім’я',
        firstName: 'Тест',
        lastName: '',
        height: '193',
        weight: '82,5',
      }),
    );
    await waitFor(() => expect(back).toHaveBeenCalledOnce());
  });

  it('rejects out-of-range measurements before PATCH', async () => {
    const view = await render(<EditProfileScreen />);
    await fireEvent.changeText(view.getByTestId('profile-weight'), '999');
    await fireEvent.press(view.getByTestId('profile-save'));

    expect(mutateAsync).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });

  it('keeps the editor open when the API rejects a valid update', async () => {
    mutateAsync.mockRejectedValue(new Error('Помилка API'));
    const view = await render(<EditProfileScreen />);
    await fireEvent.press(view.getByTestId('profile-save'));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    expect(back).not.toHaveBeenCalled();
  });
});
