import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { createThemedStyles } from '@/shared/config/theme-provider';

type Props = {
  kind: 'loading' | 'error' | 'empty';
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
  retrying?: boolean;
};

/** Consistent, accessible loading/error/empty feedback for native resources. */
export function AsyncResourceState({
  kind,
  message,
  onRetry,
  retryLabel = 'Спробувати ще раз',
  retrying = false,
}: Props) {
  const styles = useStyles();
  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      {kind === 'loading' ? <ActivityIndicator accessibilityLabel={message} /> : null}
      <Text
        style={kind === 'error' ? styles.error : styles.message}
        accessibilityRole={kind === 'error' ? 'alert' : undefined}
      >
        {message}
      </Text>
      {kind === 'error' && onRetry ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
          accessibilityState={{ disabled: retrying }}
          disabled={retrying}
          onPress={onRetry}
          style={styles.retry}
        >
          <Text style={styles.retryText}>{retryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles((palette) =>
  StyleSheet.create({
    container: { padding: 16, gap: 12, alignItems: 'center' },
    message: { textAlign: 'center', color: palette.muted, fontSize: 14 },
    error: { textAlign: 'center', color: palette.error, fontSize: 14 },
    retry: {
      minHeight: 44,
      paddingHorizontal: 16,
      justifyContent: 'center',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.border,
    },
    retryText: { color: palette.text, fontWeight: '600' },
  }),
);
