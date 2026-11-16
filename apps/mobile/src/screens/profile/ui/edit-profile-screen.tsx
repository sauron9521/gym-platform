import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  editProfileSchema,
  type EditProfileValues,
} from '@/features/profile/lib/edit-profile-schema';
import { useEditProfile } from '@/features/profile/model/edit-profile-mutation';
import { useAccountQuery } from '@/features/profile/model/account-query';
import { palette } from '@/shared/config/theme';

const fields = [
  { name: 'displayName', label: 'Ім’я на екрані' },
  { name: 'firstName', label: 'Ім’я' },
  { name: 'lastName', label: 'Прізвище' },
  { name: 'height', label: 'Зріст, см' },
  { name: 'weight', label: 'Вага, кг' },
] as const;

export function EditProfileScreen() {
  const router = useRouter();
  const profile = useAccountQuery();
  const mutation = useEditProfile();
  const data = profile.data?.profile;
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EditProfileValues>({
    resolver: zodResolver(editProfileSchema),
    values: {
      displayName: data?.displayName ?? '',
      firstName: data?.firstName ?? '',
      lastName: data?.lastName ?? '',
      height: String(data?.height ?? ''),
      weight: String(data?.weight ?? ''),
    },
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Редагувати профіль</Text>
      {fields.map((field) => (
        <View key={field.name} style={styles.field}>
          <Text style={styles.label}>{field.label}</Text>
          <Controller
            control={control}
            name={field.name}
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                accessibilityLabel={field.label}
                testID={`profile-${field.name}`}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType={
                  field.name === 'weight'
                    ? 'decimal-pad'
                    : field.name === 'height'
                      ? 'number-pad'
                      : 'default'
                }
                style={styles.input}
                editable={!mutation.isPending}
              />
            )}
          />
          {errors[field.name]?.message ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {errors[field.name]?.message}
            </Text>
          ) : null}
        </View>
      ))}
      {mutation.isError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {mutation.error.message}
        </Text>
      ) : null}
      <Pressable
        testID="profile-save"
        accessibilityRole="button"
        style={styles.button}
        disabled={mutation.isPending}
        onPress={() =>
          void handleSubmit((values) =>
            mutation.mutate(values, { onSuccess: () => router.back() }),
          )()
        }
      >
        <Text style={styles.buttonText}>{mutation.isPending ? 'Зберігаємо…' : 'Зберегти'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { padding: 24, gap: 14 },
  title: { color: palette.text, fontSize: 26, fontWeight: '700' },
  field: { gap: 7 },
  label: { color: palette.text, fontSize: 14, fontWeight: '600' },
  input: {
    minHeight: 48,
    color: palette.text,
    backgroundColor: palette.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 12,
  },
  error: { color: '#b91c1c', fontSize: 14 },
  button: {
    minHeight: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primary,
  },
  buttonText: { color: palette.surface, fontWeight: '700' },
});
