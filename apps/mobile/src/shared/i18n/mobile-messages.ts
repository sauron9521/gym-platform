import { getFlatMessages, type Locale } from '@gym/i18n';

// Mobile-specific messages extend the shared catalog without modifying other apps.
const authErrors = {
  invalidCredentials: {
    uk: 'Невірна електронна адреса або пароль.',
    en: 'Incorrect email address or password.',
  },
  invalidRequest: {
    uk: 'Перевірте електронну адресу та пароль.',
    en: 'Check your email address and password.',
  },
  accessDenied: {
    uk: 'Доступ заборонено.',
    en: 'Access denied.',
  },
  throttled: {
    uk: 'Забагато спроб входу. Спробуйте пізніше.',
    en: 'Too many sign-in attempts. Try again later.',
  },
  connectionFailed: {
    uk: 'Не вдалося з’єднатися із сервером. Спробуйте ще раз.',
    en: 'Could not connect to the server. Try again.',
  },
  storageFailed: {
    uk: 'Не вдалося захищено зберегти сесію на пристрої.',
    en: 'Could not securely store your session on this device.',
  },
  verificationFailed: {
    uk: 'Не вдалося підтвердити вхід.',
    en: 'Could not verify your sign-in.',
  },
  sessionExpired: {
    uk: 'Сесія потребує повторного входу.',
    en: 'Sign in again to restore your session.',
  },
  apiUnavailable: {
    uk: 'Не вдалося підключитися до сервера.',
    en: 'The server is unavailable.',
  },
  sessionChanged: {
    uk: 'Сесія змінилася. Спробуйте ще раз.',
    en: 'Your session changed. Try again.',
  },
  sessionVerificationFailed: {
    uk: 'Не вдалося підтвердити сесію.',
    en: 'Could not verify your session.',
  },
  restoring: {
    uk: 'Зачекайте на перевірку сесії.',
    en: 'Wait for your session to be verified.',
  },
  permissionsFailed: {
    uk: 'Не вдалося перевірити права доступу.',
    en: 'Could not verify account permissions.',
  },
  mobileAccessDenied: {
    uk: 'Цей акаунт не має доступу до мобільного застосунку.',
    en: 'This account does not have access to the mobile app.',
  },
} satisfies Record<string, Record<Locale, string>>;

export type MobileAuthErrorCode =
  keyof typeof authErrors | 'failed' | 'invalidEmail' | 'invalidPassword';

/** Only allow known message IDs; unknown codes must never be rendered as raw text. */
export function getMobileAuthErrorMessageId(code: string): string {
  const known =
    Object.hasOwn(authErrors, code) ||
    code === 'invalidEmail' ||
    code === 'invalidPassword' ||
    code === 'failed';
  return `mobile.signIn.${known ? code : 'failed'}`;
}

const navigationMessages = {
  'mobile.draft.submission-pending': {
    uk: 'Результат надсилання не підтверджено. Відновіть чернетку та повторіть той самий запит.',
    en: 'Submission is unconfirmed. Restore the draft and retry the same request.',
  },
  'mobile.draft.acknowledged': {
    uk: 'Сервер підтвердив створення тренування. Можна очистити локальну чернетку.',
    en: 'The server confirmed workout creation. You can clear the local draft.',
  },
  'mobile.draft.send': { uk: 'Надіслати тренування', en: 'Send workout' },
  'mobile.draft.resend': { uk: 'Повторити надсилання', en: 'Retry submission' },
  'mobile.draft.sendConfirm': {
    uk: 'Надіслати саме збережену форму? Якщо змінювали дані, спочатку збережіть їх. Повтор використовує той самий ключ запиту.',
    en: 'Send the saved form? Save any edits first. Retrying uses the same request key.',
  },
  'mobile.draft.clear': { uk: 'Очистити підтверджену чернетку', en: 'Clear confirmed draft' },
  'mobile.draft.clearConfirm': {
    uk: 'Видалити локальну копію? Тренування на сервері залишиться.',
    en: 'Remove the local copy? The server workout will remain.',
  },
  'mobile.draft.offline': {
    uk: 'Для надсилання потрібен інтернет.',
    en: 'Internet is required to submit.',
  },
  'mobile.draft.sendFailed': {
    uk: 'Не вдалося підтвердити надсилання. Перевірте збережену форму та стан чернетки; автоматичного повтору немає.',
    en: 'Submission could not be confirmed. Check the saved form and draft status; no automatic retry.',
  },
  'mobile.draft.sent': {
    uk: 'Тренування створено на сервері.',
    en: 'Workout created on the server.',
  },
  'mobile.draft.cleared': { uk: 'Локальну чернетку очищено.', en: 'Local draft cleared.' },
  'mobile.draft.clearFailed': {
    uk: 'Не вдалося очистити локальну копію. Серверне тренування вже створено. Повторіть лише очищення.',
    en: 'Could not clear the local copy. The server workout is already created. Retry cleanup only.',
  },
  'mobile.draft.confirmTitle': { uk: 'Підтвердження', en: 'Confirmation' },
  'mobile.draft.title': { uk: 'Локальна чернетка', en: 'Local draft' },
  'mobile.draft.hint': {
    uk: 'Зберігайте зміни локально. Перед надсиланням перевірте збережену форму та підтвердьте дію.',
    en: 'Save changes locally. Review the saved form and confirm before sending.',
  },
  'mobile.draft.none': { uk: 'Збереженої чернетки немає.', en: 'No saved draft.' },
  'mobile.draft.exists': {
    uk: 'Є локальна чернетка. Відновіть або видаліть її перед створенням нового тренування.',
    en: 'A local draft exists. Restore or discard it before creating a new workout.',
  },
  'mobile.draft.locked': { uk: 'Локальне сховище заблоковано.', en: 'Local storage is locked.' },
  'mobile.draft.preparing': {
    uk: 'Підготовка захищеного сховища…',
    en: 'Preparing secure storage…',
  },
  'mobile.draft.unavailable': {
    uk: 'Захищене сховище недоступне на цьому пристрої.',
    en: 'Secure storage is unavailable on this device.',
  },
  'mobile.draft.cleanup-required': {
    uk: 'Потрібне очищення попередніх локальних даних. Вийдіть і увійдіть знову.',
    en: 'Previous local data needs cleanup. Sign out and sign in again.',
  },
  'mobile.draft.busy': {
    uk: 'Перевірка або збереження локальних даних…',
    en: 'Checking or saving local data…',
  },
  'mobile.draft.save': { uk: 'Зберегти чернетку', en: 'Save draft' },
  'mobile.draft.restore': { uk: 'Відновити чернетку', en: 'Restore draft' },
  'mobile.draft.discard': { uk: 'Видалити чернетку', en: 'Discard draft' },
  'mobile.draft.cancel': { uk: 'Скасувати', en: 'Cancel' },
  'mobile.draft.retry': { uk: 'Перевірити сховище повторно', en: 'Check storage again' },
  'mobile.draft.restoreConfirm': {
    uk: 'Поточна форма буде замінена збереженою чернеткою.',
    en: 'The current form will be replaced by the saved draft.',
  },
  'mobile.draft.discardConfirm': {
    uk: 'Локальні дані чернетки буде видалено. Відновити їх не вдасться.',
    en: 'Local draft data will be deleted and cannot be restored.',
  },
  'mobile.draft.saved': {
    uk: 'Чернетку збережено на пристрої. Не надіслано на сервер.',
    en: 'Draft saved on this device. Not sent to the server.',
  },
  'mobile.draft.restored': {
    uk: 'Чернетку відновлено. Перевірте вправи та підходи.',
    en: 'Draft restored. Review exercises and sets.',
  },
  'mobile.draft.discarded': { uk: 'Чернетку видалено.', en: 'Draft discarded.' },
  'mobile.draft.invalid': {
    uk: 'Заповніть назву, вправи та коректні підходи для збереження.',
    en: 'Enter a title, exercises and valid sets before saving.',
  },
  'mobile.draft.failed': {
    uk: 'Не вдалося перевірити або зберегти чернетку. Повторіть перевірку або явно видаліть її.',
    en: 'Could not check or save the draft. Retry the check or explicitly discard it.',
  },
  'mobile.draft.submissionStarted': {
    uk: 'Після спроби надсилання збереження чернетки заблоковане, щоб уникнути дублювання.',
    en: 'Draft saving is blocked after a submission attempt to prevent duplicates.',
  },
  'mobile.theme.title': { uk: 'Тема оформлення', en: 'Appearance' },
  'mobile.theme.system': { uk: 'Системна', en: 'System' },
  'mobile.theme.light': { uk: 'Світла', en: 'Light' },
  'mobile.theme.dark': { uk: 'Темна', en: 'Dark' },
  'mobile.tabs.progress': { uk: 'Прогрес', en: 'Progress' },
  'mobile.navigation.appSettings': { uk: 'Налаштування застосунку', en: 'App settings' },
  'mobile.settings.appearance': { uk: 'Зовнішній вигляд', en: 'Display' },
  'mobile.settings.language': { uk: 'Мова', en: 'Language' },
  'mobile.settings.themeDeviceOnly': {
    uk: 'Тема застосовується до цього пристрою.',
    en: 'The theme applies to this device.',
  },
  'mobile.settings.languageAccount': {
    uk: 'Мова зберігається в акаунті. Для зміни потрібне підключення до сервера.',
    en: 'Language is saved to your account. Changing it requires a server connection.',
  },
  'mobile.settings.workouts': { uk: 'Тренування', en: 'Workouts' },
  'mobile.settings.autoRestTimer': { uk: 'Автоматичний таймер', en: 'Automatic rest timer' },
  'mobile.settings.autoRestTimerHint': {
    uk: 'Запускати після завершення підходу. Ручний запуск завжди доступний.',
    en: 'Start after completing a set. Manual start is always available.',
  },
  'mobile.settings.restDuration': { uk: 'Тривалість відпочинку', en: 'Default rest duration' },
  'mobile.settings.restDurationHint': {
    uk: 'Для ручного й автоматичного таймера. Зміну під час тренування не буде збережено тут.',
    en: 'For manual and automatic timers. Changes during a workout do not update this preference.',
  },
  'mobile.settings.seconds': { uk: '{seconds} с', en: '{seconds} s' },
  'mobile.settings.restSound': { uk: 'Звуковий сигнал таймера', en: 'Rest timer sound' },
  'mobile.settings.restVibration': { uk: 'Вібрація таймера', en: 'Rest timer vibration' },
  'mobile.settings.restFeedbackHint': {
    uk: 'Після завершення відпочинку або після повернення в застосунок.',
    en: 'When rest ends, or when you return to the app.',
  },
  'mobile.settings.keepWorkoutScreenAwake': {
    uk: 'Не вимикати екран під час тренування',
    en: 'Keep screen awake during workouts',
  },
  'mobile.settings.keepWorkoutScreenAwakeHint': {
    uk: 'Лише на відкритому екрані активного тренування. Може збільшити витрати заряду.',
    en: 'Only while the active workout screen is open. May increase battery use.',
  },
  'mobile.settings.showPreviousSets': {
    uk: 'Показувати попередні результати',
    en: 'Show previous results',
  },
  'mobile.settings.showPreviousSetsHint': {
    uk: 'Підказки з останнього силового тренування, без зміни введених значень. Лише на цьому пристрої.',
    en: 'Hints from the last strength workout, without changing entered values. On this device only.',
  },
  'mobile.workout.previousSet': {
    uk: 'Минулого разу: {weight} кг · {reps} повт.',
    en: 'Last time: {weight} kg · {reps} reps',
  },
  'mobile.workout.previousSetWeight': {
    uk: 'Минулого разу: {weight} кг',
    en: 'Last time: {weight} kg',
  },
  'mobile.workout.previousSetReps': {
    uk: 'Минулого разу: {reps} повт.',
    en: 'Last time: {reps} reps',
  },
  'mobile.settings.autoCollapseExercises': {
    uk: 'Автоматично згортати завершені вправи',
    en: 'Automatically collapse finished exercises',
  },
  'mobile.settings.autoCollapseExercisesHint': {
    uk: 'Коли всі підходи виконані або пропущені. Торкніться назви, щоб відкрити результати. Лише на цьому пристрої.',
    en: 'When every set is completed or skipped. Tap the exercise name to view results. On this device only.',
  },
  'mobile.workout.exerciseSetSummary': {
    uk: '{completed} виконано · {skipped} пропущено / {total}',
    en: '{completed} completed · {skipped} skipped / {total}',
  },
  'mobile.workout.exerciseSetCount': {
    uk: 'Підходів: {total}',
    en: 'Sets: {total}',
  },
  'mobile.settings.confirmWorkoutCompletion': {
    uk: 'Підтверджувати завершення тренування',
    en: 'Confirm workout completion',
  },
  'mobile.settings.confirmWorkoutCompletionHint': {
    uk: 'Додаткове підтвердження перед завершенням. Перевірки підходів залишаються обов’язковими. Лише на цьому пристрої.',
    en: 'Extra confirmation before finishing. Set validation is always required. On this device only.',
  },
  'mobile.workout.finishReviewTitle': {
    uk: 'Завершити тренування?',
    en: 'Finish workout?',
  },
  'mobile.workout.finishReviewSummary': {
    uk: '{completed} виконано · {skipped} пропущено. Після завершення підходи недоступні для редагування на цьому екрані.',
    en: '{completed} completed · {skipped} skipped. After finishing, sets can no longer be edited on this screen.',
  },
  'mobile.workout.finishReviewConfirm': {
    uk: 'Так, завершити',
    en: 'Yes, finish',
  },
  'mobile.workout.finishReviewCancel': {
    uk: 'Повернутися до тренування',
    en: 'Return to workout',
  },
  'mobile.workout.finishEditBlocked': {
    uk: 'Збережіть або скасуйте редагування підходів перед завершенням.',
    en: 'Save or cancel set edits before finishing.',
  },
  'mobile.settings.pending': { uk: 'Зачекайте…', en: 'Please wait…' },
  'mobile.settings.storageError': {
    uk: 'Не вдалося зберегти або прочитати налаштування. Спробуйте ще раз.',
    en: 'Could not save or read settings. Please try again.',
  },
  'mobile.settings.retry': { uk: 'Повторити', en: 'Retry' },
  'mobile.settings.deviceOnly': {
    uk: 'Звук, вібрація, утримання екрана, підказки, згортання вправ та підтвердження завершення зберігаються лише на цьому пристрої.',
    en: 'Sound, vibration, screen wake, hints, exercise collapse and finish confirmation are saved only on this device.',
  },
  'mobile.settings.workoutAccount': {
    uk: 'Автотаймер і тривалість відпочинку синхронізуються з акаунтом.',
    en: 'Automatic rest timer and default rest duration sync with your account.',
  },
  'mobile.settings.workoutOffline': {
    uk: 'Немає мережі. Використовуються локальні налаштування; для зміни потрібне підключення.',
    en: 'Offline. Local settings are in use; reconnect to make changes.',
  },
  'mobile.settings.workoutSyncError': {
    uk: 'Не вдалося синхронізувати налаштування акаунта. Спробуйте ще раз.',
    en: 'Could not sync account workout preferences. Please try again.',
  },
  'mobile.navigation.workoutCalendar': { uk: 'Календар тренувань', en: 'Workout calendar' },
  'mobile.calendar.statusMissed': { uk: 'Пропущено', en: 'Missed' },
  'mobile.calendar.statusCompletedLate': { uk: 'Завершено із запізненням', en: 'Completed late' },
  'mobile.calendar.zonePolicy': {
    uk: 'Часовий пояс пристрою. Пропущено — запланований день уже минув.',
    en: 'Device time zone. Missed means the scheduled day has ended.',
  },
  'mobile.calendar.description': {
    uk: 'Тренування за запланованою датою. Незалежно від статусу.',
    en: 'Workouts by scheduled date, regardless of status.',
  },
  'mobile.calendar.month': { uk: 'Місяць', en: 'Month' },
  'mobile.calendar.week': { uk: 'Тиждень', en: 'Week' },
  'mobile.calendar.previousWeek': { uk: 'Попередній тиждень', en: 'Previous week' },
  'mobile.calendar.nextWeek': { uk: 'Наступний тиждень', en: 'Next week' },
  'mobile.calendar.weekAgenda': { uk: 'Тренування тижня', en: 'Weekly workouts' },
  'mobile.calendar.emptyWeek': {
    uk: 'На цей тиждень немає тренувань із запланованою датою.',
    en: 'No scheduled workouts this week.',
  },
  'mobile.calendar.tooManyWeek': {
    uk: 'Забагато тренувань за цей тиждень. Повний календар недоступний.',
    en: 'Too many workouts this week. The full calendar is unavailable.',
  },
  'mobile.calendar.previous': { uk: 'Попередній місяць', en: 'Previous month' },
  'mobile.calendar.next': { uk: 'Наступний місяць', en: 'Next month' },
  'mobile.calendar.today': { uk: 'Сьогодні', en: 'Today' },
  'mobile.calendar.loading': { uk: 'Завантаження календаря…', en: 'Loading calendar…' },
  'mobile.calendar.tooMany': {
    uk: 'Забагато тренувань за цей місяць. Повний календар недоступний.',
    en: 'Too many workouts this month. The full calendar is unavailable.',
  },
  'mobile.calendar.incomplete': {
    uk: 'Не вдалося отримати повний календар. Спробуйте ще раз.',
    en: 'Could not load the complete calendar. Try again.',
  },
  'mobile.calendar.retry': { uk: 'Повторити', en: 'Retry' },
  'mobile.calendar.refresh': { uk: 'Оновити календар', en: 'Refresh calendar' },
  'mobile.calendar.emptyMonth': {
    uk: 'На цей місяць немає тренувань із запланованою датою.',
    en: 'No scheduled workouts this month.',
  },
  'mobile.calendar.emptyDay': {
    uk: 'На цей день тренувань немає.',
    en: 'No workouts on this day.',
  },
  'mobile.calendar.dayLabel': { uk: '{date}. Тренувань: {count}', en: '{date}. Workouts: {count}' },
  'mobile.calendar.mon': { uk: 'Пн', en: 'Mon' },
  'mobile.calendar.tue': { uk: 'Вт', en: 'Tue' },
  'mobile.calendar.wed': { uk: 'Ср', en: 'Wed' },
  'mobile.calendar.thu': { uk: 'Чт', en: 'Thu' },
  'mobile.calendar.fri': { uk: 'Пт', en: 'Fri' },
  'mobile.calendar.sat': { uk: 'Сб', en: 'Sat' },
  'mobile.calendar.sun': { uk: 'Нд', en: 'Sun' },
  'mobile.activeWorkout.resume': { uk: 'Повернутися до тренування', en: 'Return to workout' },
  'mobile.activeWorkout.hint': {
    uk: 'Останнє відкрите активне тренування',
    en: 'Last opened active workout',
  },
  'mobile.activeWorkout.rest': { uk: 'Відпочинок', en: 'Rest' },
  'mobile.activeWorkout.paused': { uk: 'Пауза', en: 'Paused' },
  'mobile.navigation.editProfile': { uk: 'Редагувати профіль', en: 'Edit profile' },
  'mobile.navigation.exercises': { uk: 'Вправи', en: 'Exercises' },
  'mobile.navigation.workout': { uk: 'Тренування', en: 'Workout' },
  'mobile.navigation.exerciseProgress': { uk: 'Прогрес вправи', en: 'Exercise progress' },
  'mobile.navigation.program': { uk: 'Програма', en: 'Program' },
  'mobile.navigation.newWorkout': { uk: 'Нове тренування', en: 'New workout' },
  'mobile.navigation.athletes': { uk: 'Мої підопічні', en: 'My athletes' },
  'mobile.navigation.restoring': { uk: 'Відновлення сесії', en: 'Restoring session' },
} satisfies Record<string, Record<Locale, string>>;

export function getMobileMessages(locale: Locale): Record<string, string> {
  return {
    ...getFlatMessages(locale),
    ...Object.fromEntries(
      Object.entries(navigationMessages).map(([id, messages]) => [id, messages[locale]]),
    ),
    ...Object.fromEntries(
      Object.entries(authErrors).map(([code, translations]) => [
        getMobileAuthErrorMessageId(code),
        translations[locale],
      ]),
    ),
  };
}
