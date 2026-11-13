import type { operations } from '@gym/api-client';

export type Account = operations['UsersController_me']['responses'][200]['content']['application/json'];
export type ProfilePatch =
  operations['UsersController_updateMe']['requestBody']['content']['application/json'];

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

export function buildProfilePatch(draft: ProfileDraft): { data?: ProfilePatch; error?: string } {
  const firstName = draft.firstName.trim();
  const lastName = draft.lastName.trim();
  const displayName = draft.displayName.trim();
  const timezone = draft.timezone.trim();
  if ([firstName, lastName, displayName].some((value) => value.length > 100)) {
    return { error: 'Ім’я, прізвище та відображуване ім’я мають містити не більше 100 символів.' };
  }
  if (!timezone || timezone.length > 100 || !/^[A-Za-z0-9_+./-]+$/.test(timezone)) {
    return { error: 'Вкажіть коректний часовий пояс, наприклад Europe/Kyiv.' };
  }
  const optionalNumber = (value: string, label: string, min: number, max: number) => {
    if (!value.trim()) return { value: null };
    const number = Number(value);
    if (!Number.isFinite(number) || number < min || number > max) {
      return { error: `Некоректне значення: ${label}.` };
    }
    return { value: number };
  };
  const height = optionalNumber(draft.height, 'зріст', 1, 300);
  const weight = optionalNumber(draft.weight, 'вага', 1, 700);
  if (height.error || weight.error) return { error: height.error ?? weight.error };
  if (
    draft.birthday &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(draft.birthday) ||
      !Number.isFinite(Date.parse(draft.birthday)) ||
      draft.birthday > new Date().toISOString().slice(0, 10))
  ) {
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
