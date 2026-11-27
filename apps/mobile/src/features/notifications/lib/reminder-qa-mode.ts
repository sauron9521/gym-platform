import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { isReminderQaEnabled } from './reminder-qa-policy';

const config = Constants.expoConfig;
// QA marker is generated only by app.config.js. Expo Go, Web and ordinary
// release configs fail closed. Actual artifact identity is verified by QA.
export const REMINDER_QA_ENABLED = isReminderQaEnabled({
  marker: config?.extra?.reminderQa,
  platform: Platform.OS,
  executionEnvironment: Constants.executionEnvironment,
  configuredAppId:
    Platform.OS === 'android' ? config?.android?.package : config?.ios?.bundleIdentifier,
  apiUrl: process.env.EXPO_PUBLIC_API_URL,
});
