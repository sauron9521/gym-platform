import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useRestFeedback, type RestFeedback } from '@/features/workouts/lib/use-rest-feedback';

const audio = vi.hoisted(() => ({
  mode: vi.fn(),
  seek: vi.fn(),
  play: vi.fn(),
  vibrate: vi.fn(),
}));
vi.mock('expo-audio', () => ({
  setAudioModeAsync: audio.mode,
  useAudioPlayer: () => ({ seekTo: audio.seek, play: audio.play }),
}));
vi.mock('expo-haptics', () => ({
  NotificationFeedbackType: { Success: 'success' },
  notificationAsync: audio.vibrate,
}));
vi.mock('../../assets/rest-complete.wav', () => ({ default: 1 }));

function Trigger({ feedback, isCurrent }: { feedback: RestFeedback; isCurrent?: () => boolean }) {
  const notify = useRestFeedback();
  return (
    <Pressable onPress={() => notify(feedback, isCurrent)}>
      <Text>signal</Text>
    </Pressable>
  );
}

beforeEach(() => {
  audio.mode.mockReset().mockResolvedValue(undefined);
  audio.seek.mockReset().mockResolvedValue(undefined);
  audio.play.mockReset();
  audio.vibrate.mockReset().mockResolvedValue(undefined);
});

describe('rest completion feedback', () => {
  it('plays audio independently, respecting silent mode and other music', async () => {
    const view = await render(<Trigger feedback={{ sound: true, vibration: false }} />);
    await fireEvent.press(view.getByText('signal'));
    await waitFor(() => expect(audio.play).toHaveBeenCalledOnce());
    expect(audio.mode).toHaveBeenCalledWith(
      expect.objectContaining({
        playsInSilentMode: false,
        interruptionMode: 'mixWithOthers',
        allowsRecording: false,
      }),
    );
    expect(audio.seek).toHaveBeenCalledWith(0);
    expect(audio.vibrate).not.toHaveBeenCalled();
  });

  it('vibrates independently and keeps both disabled silent', async () => {
    const view = await render(<Trigger feedback={{ sound: false, vibration: true }} />);
    await fireEvent.press(view.getByText('signal'));
    await waitFor(() => expect(audio.vibrate).toHaveBeenCalledOnce());
    expect(audio.play).not.toHaveBeenCalled();
    await view.rerender(<Trigger feedback={{ sound: false, vibration: false }} />);
    await fireEvent.press(view.getByText('signal'));
    expect(audio.vibrate).toHaveBeenCalledOnce();
    expect(audio.mode).not.toHaveBeenCalled();
  });

  it('suppresses delayed audio after the originating timer is no longer current', async () => {
    let finish!: () => void;
    audio.mode.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    let current = true;
    const view = await render(
      <Trigger feedback={{ sound: true, vibration: false }} isCurrent={() => current} />,
    );
    await fireEvent.press(view.getByText('signal'));
    expect(audio.mode).toHaveBeenCalledOnce();
    current = false;
    await act(async () => finish());
    expect(audio.seek).not.toHaveBeenCalled();
    expect(audio.play).not.toHaveBeenCalled();
  });

  it('does not play a delayed signal after unmount and isolates haptic failure', async () => {
    let finish!: () => void;
    audio.mode.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    audio.vibrate.mockRejectedValue(new Error('unsupported'));
    const view = await render(<Trigger feedback={{ sound: true, vibration: true }} />);
    await fireEvent.press(view.getByText('signal'));
    await waitFor(() => expect(audio.vibrate).toHaveBeenCalledOnce());
    await view.unmount();
    await act(async () => finish());
    expect(audio.play).not.toHaveBeenCalled();
  });
});
