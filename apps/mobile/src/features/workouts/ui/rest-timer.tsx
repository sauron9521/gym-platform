import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatRestTime, secondsRemaining } from '../lib/rest-timer';
import { palette } from '@/shared/config/theme';

/** Local-only countdown; no background timers or duplicate server writes. */
export function RestTimer() {
  const [duration, setDuration] = useState(90);
  const [remaining, setRemaining] = useState(90);
  const [deadline, setDeadline] = useState<number | null>(null);

  useEffect(() => {
    if (deadline === null) return;
    const tick = () => {
      const next = secondsRemaining(deadline, Date.now());
      setRemaining(next);
      if (next === 0) setDeadline(null);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  const toggle = () => {
    if (deadline !== null) {
      setRemaining(secondsRemaining(deadline, Date.now()));
      setDeadline(null);
    } else {
      setDeadline(Date.now() + remaining * 1000);
    }
  };
  const reset = () => {
    setDeadline(null);
    setRemaining(duration);
  };

  return (
    <View style={styles.container} accessibilityLabel="Таймер відпочинку">
      <Text style={styles.heading}>Відпочинок між підходами</Text>
      <Text style={styles.time} accessibilityLiveRegion="polite">{formatRestTime(remaining)}</Text>
      <View style={styles.actions}>
        {[60, 90, 120].map((seconds) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: duration === seconds }}
            key={seconds}
            disabled={deadline !== null}
            onPress={() => { setDuration(seconds); setRemaining(seconds); }}
            style={styles.choice}
          >
            <Text style={styles.text}>{seconds} с</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={toggle} style={styles.button}>
          <Text style={styles.buttonText}>{deadline === null ? 'Старт' : 'Пауза'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={reset} style={styles.choice}>
          <Text style={styles.text}>Скинути</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: palette.surface, borderRadius: 12, borderColor: palette.border, borderWidth: 1, padding: 14, gap: 10 },
  heading: { color: palette.text, fontWeight: '600' },
  time: { color: palette.primary, fontSize: 30, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8 },
  choice: { borderWidth: 1, borderColor: palette.border, padding: 10, minHeight: 44, justifyContent: 'center', borderRadius: 8 },
  text: { color: palette.text },
  button: { backgroundColor: palette.primary, padding: 10, borderRadius: 8, minHeight: 44, justifyContent: 'center' },
  buttonText: { color: palette.background, fontWeight: '700' },
});
