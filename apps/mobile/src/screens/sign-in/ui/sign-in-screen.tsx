import { useCallback, useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
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

import { signInSchema, type SignInValues } from '@/features/auth/lib/login-flow';
import { useAuth } from '@/features/auth/model/auth-context';
import { palette } from '@/shared/config/theme';

export function SignInScreen() {
  const { signIn } = useAuth();
  const submitLock = useRef(false);
  const {
    control,
    handleSubmit,
    clearErrors,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const onValidSubmit = useCallback(
    async ({ email, password }: SignInValues) => {
      // React Hook Form validates first; this protects against concurrent API calls.
      if (submitLock.current) return;
      submitLock.current = true;
      clearErrors('root.server');
      try {
        const result = await signIn(email, password);
        if (!result.success) {
          setError('root.server', { type: 'server', message: result.message });
        }
      } catch {
        setError('root.server', {
          type: 'server',
          message: 'Не вдалося увійти. Спробуйте ще раз.',
        });
      } finally {
        submitLock.current = false;
      }
    },
    [clearErrors, setError, signIn],
  );

  const submit = () => void handleSubmit(onValidSubmit)();

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
          <Controller
            control={control}
            name="email"
            render={({ field: { onBlur, onChange, value } }) => (
              <TextInput
                accessibilityLabel="Електронна пошта"
                testID="sign-in-email"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                maxLength={254}
                editable={!isSubmitting}
                value={value}
                onBlur={onBlur}
                onChangeText={(nextValue) => {
                  onChange(nextValue);
                  clearErrors('root.server');
                }}
                placeholder="name@example.com"
                style={[styles.input, errors.email && styles.inputError]}
              />
            )}
          />
          {errors.email?.message ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {errors.email.message}
            </Text>
          ) : null}
          <Text style={styles.label}>Пароль</Text>
          <Controller
            control={control}
            name="password"
            render={({ field: { onBlur, onChange, value } }) => (
              <TextInput
                accessibilityLabel="Пароль"
                testID="sign-in-password"
                autoCapitalize="none"
                autoComplete="current-password"
                secureTextEntry
                editable={!isSubmitting}
                value={value}
                onBlur={onBlur}
                onChangeText={(nextValue) => {
                  onChange(nextValue);
                  clearErrors('root.server');
                }}
                onSubmitEditing={() => void submit()}
                placeholder="Введіть пароль"
                style={[styles.input, errors.password && styles.inputError]}
              />
            )}
          />
          {errors.password?.message ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {errors.password.message}
            </Text>
          ) : null}
          {errors.root?.server?.message ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {errors.root.server.message}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={() => void submit()}
            style={[styles.button, isSubmitting && styles.disabled]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={palette.surface} />
            ) : (
              <Text style={styles.buttonText}>Увійти</Text>
            )}
          </Pressable>
        </View>
        <Text style={styles.note}>
          На iOS та Android сесія зберігається захищено. У браузері вхід тимчасовий.
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
  inputError: { borderColor: '#b91c1c' },
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
