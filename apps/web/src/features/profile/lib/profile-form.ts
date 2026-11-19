import type { operations } from '@gym/api-client';
import { z } from 'zod';

type MeResponse = operations['UsersController_me']['responses'][200];
export type Account = MeResponse['content']['application/json'];
type UpdateMe = operations['UsersController_updateMe'];
export type ProfilePatch = UpdateMe['requestBody']['content']['application/json'];

export type ProfileValidationMessages = {
  nameTooLong: string;
  heightInvalid: string;
  weightInvalid: string;
  birthdayInvalid: string;
  timezoneRequired: string;
  timezoneTooLong: string;
  timezoneInvalid: string;
};

const defaultValidationMessages: ProfileValidationMessages = {
  nameTooLong: 'Максимум 100 символів.',
  heightInvalid: 'Некоректне значення: зріст.',
  weightInvalid: 'Некоректне значення: вага.',
  birthdayInvalid: 'Перевірте дату народження.',
  timezoneRequired: 'Вкажіть часовий пояс.',
  timezoneTooLong: 'Часовий пояс занадто довгий.',
  timezoneInvalid: 'Вкажіть коректний часовий пояс, наприклад Europe/Kyiv.',
};

/** Localized validation preserves all existing profile limits and parsing rules. */
export function createProfileSchema(
  messages: ProfileValidationMessages = defaultValidationMessages,
) {
  const personName = z.string().trim().max(100, messages.nameTooLong);

  const measurement = (message: string, min: number, max: number, integer = false) =>
    z.string().refine((input) => {
      if (!input.trim()) return true;
      const value = Number(input);
      if (!Number.isFinite(value) || value < min || value > max) return false;
      if (integer) return Number.isInteger(value);
      return /^[0-9]+(?:\.[0-9]{1,2})?$/.test(input.trim());
    }, message);

  const birthday = z.string().refine((input) => {
    if (!input) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return false;
    if (input < '1900-01-01' || input > new Date().toISOString().slice(0, 10)) {
      return false;
    }
    const date = new Date(`${input}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === input;
  }, messages.birthdayInvalid);

  const timezonePattern = /^(?:UTC|[A-Za-z_]+\/[A-Za-z0-9_+.-]+(?:\/[A-Za-z0-9_+.-]+)?)$/;

  const timezone = z
    .string()
    .trim()
    .min(1, messages.timezoneRequired)
    .max(64, messages.timezoneTooLong)
    .refine((value) => {
      if (!timezonePattern.test(value)) return false;
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, messages.timezoneInvalid);

  return z.object({
    firstName: personName,
    lastName: personName,
    displayName: personName,
    birthday,
    height: measurement(messages.heightInvalid, 50, 300, true),
    weight: measurement(messages.weightInvalid, 1, 600),
    timezone,
  });
}

export const profileSchema = createProfileSchema();

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

export function buildProfilePatch(
  draft: ProfileDraft,
  schema: typeof profileSchema = profileSchema,
): { data?: ProfilePatch; error?: string } {
  const parsed = schema.safeParse(draft);
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

/** Never display untrusted API payload strings in the localized profile UI. */
export function getProfileErrorKey(
  status: number,
): 'invalid' | 'signedOut' | 'forbidden' | 'rateLimited' | 'requestFailed' {
  if (status === 400 || status === 422) return 'invalid';
  if (status === 401) return 'signedOut';
  if (status === 403) return 'forbidden';
  if (status === 429) return 'rateLimited';
  return 'requestFailed';
}
