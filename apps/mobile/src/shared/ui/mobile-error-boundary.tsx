import { Component, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette } from '@/shared/config/theme';

type Props = { children: ReactNode };
type State = { failed: boolean };

/** Safe local fallback; production telemetry can be added when Sentry is configured. */
export class MobileErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    // Do not log user data or API response bodies in production builds.
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('Unexpected mobile screen failure:', error.name);
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={styles.container}>
        <Text accessibilityRole="alert" style={styles.title}>Виникла помилка інтерфейсу</Text>
        <Text style={styles.message}>Спробуйте відновити екран. Незбережені зміни можуть бути втрачені.</Text>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => this.setState({ failed: false })}>
          <Text style={styles.buttonText}>Відновити екран</Text>
        </Pressable>
      </View>
    );
  }
}
const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16, backgroundColor: palette.background, alignItems: 'center', justifyContent: 'center' },
  title: { color: palette.text, fontWeight: '700', fontSize: 20 },
  message: { color: palette.muted, textAlign: 'center', lineHeight: 22 },
  button: { backgroundColor: palette.primary, padding: 14, borderRadius: 12, minHeight: 48, justifyContent: 'center' },
  buttonText: { color: palette.background, fontWeight: '700' },
});
