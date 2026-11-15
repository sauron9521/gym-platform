import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/features/auth/model/auth-context';
import { palette } from '@/shared/config/theme';

export function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await signIn(email, password);
      if (!result.success) setError(result.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>GYM PLATFORM</Text>
        <Text style={styles.heading}>З поверненням!</Text>
        <Text style={styles.description}>Увійдіть, щоб переглянути свій профіль.</Text>
        <View style={styles.form}>
          <Text style={styles.label}>Електронна пошта</Text>
          <TextInput
            accessibilityLabel="Електронна пошта"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            maxLength={254}
            editable={!submitting}
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setError(null);
            }}
            placeholder="name@example.com"
            style={styles.input}
          />
          <Text style={styles.label}>Пароль</Text>
          <TextInput
            accessibilityLabel="Пароль"
            autoCapitalize="none"
            autoComplete="current-password"
            secureTextEntry
            editable={!submitting}
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setError(null);
            }}
            onSubmitEditing={() => void submit()}
            placeholder="Введіть пароль"
            style={styles.input}
          />
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={submitting}
            onPress={() => void submit()}
            style={[styles.button, submitting && styles.disabled]}
          >
            {submitting ? (
              <ActivityIndicator color={palette.surface} />
            ) : (
              <Text style={styles.buttonText}>Увійти</Text>
            )}
          </Pressable>
        </View>
        <Text style={styles.note}>
          Сесія тимчасова: після перезапуску потрібно ввійти знову.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 12 },
  eyebrow: { color: palette.primary, fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  heading: { color: palette.text, fontSize: 32, fontWeight: '700' },
  description: { color: palette.muted, fontSize: 16, lineHeight: 24 },
  form: { gap: 12, marginTop: 18 },
  label: { color: palette.text, fontSize: 14, fontWeight: '600' },
  input: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 14,
    color: palette.text,
    fontSize: 16,
  },
  error: { color: '#b91c1c', fontSize: 14 },
  button: {
    backgroundColor: palette.primary,
    padding: 14,
    borderRadius: 12,
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  disabled: { opacity: 0.65 },
  buttonText: { color: palette.surface, fontSize: 16, fontWeight: '700' },
  note: { color: palette.muted, fontSize: 13, lineHeight: 20, marginTop: 20 },
});
