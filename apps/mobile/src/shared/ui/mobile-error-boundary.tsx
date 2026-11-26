import { Component, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { mobileDiagnostics } from '@/shared/diagnostics/mobile-diagnostics';
import { createThemedStyles } from '@/shared/config/theme-provider';

type Props = { children: ReactNode };
type State = { failed: boolean };

/**
 * Catches render/lifecycle exceptions in the authenticated mobile tree.
 * Never render error messages or serialized data into the fallback.
 */
export class MobileErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch() {
    // Do not pass the exception, message, component stack or user context.
    mobileDiagnostics.report({ version: 1, kind: 'render_failure' });
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return <ErrorFallback onRetry={() => this.setState({ failed: false })} />;
  }
}

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const styles = useStyles();
  return (
    <View style={styles.container} testID="mobile-error-fallback">
      <Text accessibilityRole="alert" style={styles.title}>
        Виникла помилка інтерфейсу
      </Text>
      <Text style={styles.message}>
        Спробуйте відновити екран. Незбережені зміни можуть бути втрачені.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Відновити екран"
        testID="mobile-error-retry"
        style={styles.button}
        onPress={onRetry}
      >
        <Text style={styles.buttonText}>Відновити екран</Text>
      </Pressable>
    </View>
  );
}

const useStyles = createThemedStyles((palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 24,
      gap: 16,
      backgroundColor: palette.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { color: palette.text, fontWeight: '700', fontSize: 20 },
    message: { color: palette.muted, textAlign: 'center', lineHeight: 22 },
    button: {
      backgroundColor: palette.primary,
      padding: 14,
      borderRadius: 12,
      minHeight: 48,
      justifyContent: 'center',
    },
    buttonText: { color: palette.primaryForeground, fontWeight: '700' },
  }),
);
