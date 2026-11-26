import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import restCompleteSound from '../../../../assets/rest-complete.wav';

export type RestFeedback = { sound: boolean; vibration: boolean };

/** Playback only; neither recording nor background audio is enabled. */
export function useRestFeedback() {
  const player = useAudioPlayer(restCompleteSound, {
    allowsExternalPlayback: false,
  });
  const mounted = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
    };
  }, []);

  return useCallback(
    (feedback: RestFeedback, isCurrent: () => boolean = () => true) => {
      const current = ++generation.current;
      const canPlay = () =>
        mounted.current &&
        generation.current === current &&
        isCurrent() &&
        AppState.currentState !== 'background' &&
        AppState.currentState !== 'inactive';
      if (feedback.vibration) {
        void Promise.resolve()
          .then(() => {
            if (canPlay())
              return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          })
          .catch(() => undefined);
      }
      if (feedback.sound) {
        // Respect silent mode and avoid interrupting music. Playback failures
        // (including browser autoplay restrictions) never affect the countdown.
        void (async () => {
          try {
            await setAudioModeAsync({
              playsInSilentMode: false,
              interruptionMode: 'mixWithOthers',
              allowsRecording: false,
              shouldPlayInBackground: false,
            });
            if (!canPlay()) return;
            await player.seekTo(0);
            if (!canPlay()) return;
            player.play();
          } catch {
            // Audio is best-effort on the current device.
          }
        })();
      }
    },
    [player],
  );
}
