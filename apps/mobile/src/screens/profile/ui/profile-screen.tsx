import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/model/auth-context';
import { palette } from '@/shared/config/theme';

export function ProfileScreen() {
  const { account, refreshProfile, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!account) return null;

  const name = account.profile?.displayName ||
    [account.profile?.firstName, account.profile?.lastName].filter(Boolean).join(' ') ||
    'Мій профіль';

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      setError(await refreshProfile());
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>{name}</Text>
      <Text style={styles.subheading}>Дані з Gym API</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Електронна пошта</Text>
        <Text style={styles.value}>{account.email}</Text>
        <Text style={styles.label}>Роль</Text>
        <Text style={styles.value}>{account.role}</Text>
        <Text style={styles.label}>Пошта</Text>
        <Text style={styles.value}>
          {account.emailVerified ? 'Підтверджена' : 'Не підтверджена'}
        </Text>
        {account.profile?.height != null ? (
          <>
            <Text style={styles.label}>Зріст</Text>
            <Text style={styles.value}>{account.profile.height} см</Text>
          </>
        ) : null}
        {account.profile?.weight != null ? (
          <>
            <Text style={styles.label}>Вага</Text>
            <Text style={styles.value}>{account.profile.weight} кг</Text>
          </>
        ) : null}
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => void refresh()}
        style={styles.button}
      >
        {busy ? <ActivityIndicator color={palette.surface} /> : (
          <Text style={styles.buttonText}>Оновити профіль</Text>
        )}
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => void signOut()} style={styles.secondary}>
        <Text style={styles.secondaryText}>Вийти</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 24, gap: 16 },
  heading: { fontSize: 30, fontWeight: '700', color: palette.text },
  subheading: { color: palette.muted, fontSize: 15 },
  card: {
    backgroundColor: palette.surface, borderColor: palette.border,
    borderWidth: 1, borderRadius: 16, padding: 22, gap: 10,
  },
  label: { color: palette.muted, fontSize: 13 },
  value: { color: palette.text, fontWeight: '600', fontSize: 16, marginBottom: 8 },
  error: { color: '#b91c1c', fontSize: 14 },
  button: {
    minHeight: 48, borderRadius: 12, backgroundColor: palette.primary,
    justifyContent: 'center', alignItems: 'center', padding: 12,
  },
  buttonText: { color: palette.surface, fontWeight: '700', fontSize: 16 },
  secondary: {
    minHeight: 48, borderRadius: 12, borderColor: palette.border,
    borderWidth: 1, justifyContent: 'center', alignItems: 'center',
  },
  secondaryText: { color: palette.text, fontWeight: '600', fontSize: 16 },
});
