import type { operations } from '@gym/api-client';

type MeResponse = operations['UsersController_me']['responses'][200];
export type Account = MeResponse['content']['application/json'];
type UpdateMe = operations['UsersController_updateMe'];
export type ProfilePatch = UpdateMe['requestBody']['content']['application/json'];

export type ProfileDraft = {
  firstName: string;
  lastName: string;
  displayName: string;
  birthday: string;
  height: string;
  weight: string;
  timezone: string;
};

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

function parseMeasurement(
  input: string,
  label: string,
  min: number,
  max: number,
): { value: number | null; error?: string } {
  if (!input.trim()) return { value: null };
  const value = Number(input);
  const valid = Number.isFinite(value) && value >= min && value <= max;
  if (!valid) return { value: null, error: `Некоректне значення: ${label}.` };
  return { value };
}

function validBirthday(input: string): boolean {
  if (!input) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return false;
  const timestamp = Date.parse(input);
  if (!Number.isFinite(timestamp)) return false;
  return input <= new Date().toISOString().slice(0, 10);
}

export function buildProfilePatch(draft: ProfileDraft): { data?: ProfilePatch; error?: string } {
  const firstName = draft.firstName.trim();
  const lastName = draft.lastName.trim();
  const displayName = draft.displayName.trim();
  const timezone = draft.timezone.trim();
  const names = [firstName, lastName, displayName];

  if (names.some((value) => value.length > 100)) {
    return { error: 'Ім’я, прізвище та відображуване ім’я мають містити не більше 100 символів.' };
  }
  const timezonePattern = /^[A-Za-z0-9_+./-]+$/;
  if (!timezone || timezone.length > 100 || !timezonePattern.test(timezone)) {
    return { error: 'Вкажіть коректний часовий пояс, наприклад Europe/Kyiv.' };
  }

  const height = parseMeasurement(draft.height, 'зріст', 1, 300);
  const weight = parseMeasurement(draft.weight, 'вага', 1, 700);
  if (height.error) return { error: height.error };
  if (weight.error) return { error: weight.error };
  if (!validBirthday(draft.birthday)) {
    return { error: 'Перевірте дату народження.' };
  }

  return {
    data: {
      firstName: firstName || null,
      lastName: lastName || null,
      displayName: displayName || null,
      birthday: draft.birthday || null,
      height: height.value,
      weight: weight.value,
      timezone,
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
