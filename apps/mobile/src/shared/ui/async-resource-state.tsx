import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { palette } from '@/shared/config/theme';

type Props = {
  kind: 'loading' | 'error' | 'empty';
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
};

/** A consistent, accessible state for paginated mobile resources. */
export function AsyncResourceState({ kind, message, onRetry, retryLabel = 'Спробувати ще раз' }: Props) {
  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      {kind === 'loading' ? <ActivityIndicator accessibilityLabel={message} /> : null}
      <Text style={kind === 'error' ? styles.error : styles.message} accessibilityRole={kind === 'error' ? 'alert' : undefined}>
        {message}
      </Text>
      {kind === 'error' && onRetry ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
          onPress={onRetry}
          style={styles.retry}
        >
          <Text style={styles.retryText}>{retryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, alignItems: 'center' },
  message: { textAlign: 'center', color: palette.muted, fontSize: 14 },
  error: { textAlign: 'center', color: '#ff6460', fontSize: 14 },
  retry: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
  },
  retryText: { color: palette.text, fontWeight: '600' },
});
