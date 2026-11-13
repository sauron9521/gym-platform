import type { operations } from '@gym/api-client';
import { z } from 'zod';

type MeResponse = operations['UsersController_me']['responses'][200];
export type Account = MeResponse['content']['application/json'];
type UpdateMe = operations['UsersController_updateMe'];
export type ProfilePatch = UpdateMe['requestBody']['content']['application/json'];

const personName = z.string().trim().max(100, 'Максимум 100 символів.');

const measurement = (label: string, min: number, max: number, integer = false) =>
  z.string().refine((input) => {
    if (!input.trim()) return true;
    const value = Number(input);
    if (!Number.isFinite(value) || value < min || value > max) return false;
    if (integer) return Number.isInteger(value);
    return /^[0-9]+(?:\.[0-9]{1,2})?$/.test(input.trim());
  }, `Некоректне значення: ${label}.`);

const birthday = z.string().refine((input) => {
  if (!input) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return false;
  if (input < '1900-01-01' || input > new Date().toISOString().slice(0, 10)) {
    return false;
  }
  const date = new Date(`${input}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === input;
}, 'Перевірте дату народження.');

const timezonePattern = /^(?:UTC|[A-Za-z_]+\/[A-Za-z0-9_+.-]+(?:\/[A-Za-z0-9_+.-]+)?)$/;

const timezone = z
  .string()
  .trim()
  .min(1, 'Вкажіть часовий пояс.')
  .max(64, 'Часовий пояс занадто довгий.')
  .refine((value) => {
    if (!timezonePattern.test(value)) return false;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'Вкажіть коректний часовий пояс, наприклад Europe/Kyiv.');

export const profileSchema = z.object({
  firstName: personName,
  lastName: personName,
  displayName: personName,
  birthday,
  height: measurement('зріст', 50, 300, true),
  weight: measurement('вага', 1, 600),
  timezone,
});

export type ProfileDraft = z.infer<typeof profileSchema>;

export function toProfileDraft(account: Account): ProfileDraft {
  const profile = account.profile;
  return {
    firstName: profile?.firstName ?? '',
    lastName: profile?.lastName ?? '',
    displayName: profile?.displayName ?? '',
    birthday: profile?.birthday ?? '',
    height: profile?.height == null ? '' : String(profile.height),
    weight: profile?.weight == null ? '' : String(profile.weight),
    timezone: profile?.timezone ?? 'Europe/Kyiv',
  };
}

export function buildProfilePatch(draft: ProfileDraft): { data?: ProfilePatch; error?: string } {
  const parsed = profileSchema.safeParse(draft);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Перевірте дані профілю.' };
  }
  const values = parsed.data;
  return {
    data: {
      firstName: values.firstName || null,
      lastName: values.lastName || null,
      displayName: values.displayName || null,
      birthday: values.birthday || null,
      height: values.height ? Number(values.height) : null,
      weight: values.weight ? Number(values.weight) : null,
      timezone: values.timezone,
    },
  };
}

export function getProfileErrorMessage(status: number): string {
  if (status === 400 || status === 422) return 'Перевірте введені дані профілю.';
  if (status === 401) return 'Сесію завершено. Увійдіть повторно.';
  if (status === 403) return 'Недостатньо прав для цієї дії.';
  if (status === 429) return 'Забагато запитів. Спробуйте пізніше.';
  return 'Не вдалося виконати запит. Спробуйте пізніше.';
}
