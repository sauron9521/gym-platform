import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useIntl } from 'react-intl';

import { createThemedStyles } from '@/shared/config/theme-provider';
import type { useWorkoutDraftForm } from '../model/use-workout-draft-form';

type Props = {
  draft: ReturnType<typeof useWorkoutDraftForm>;
  disabled: boolean;
  submissionStarted: boolean;
};

export function WorkoutDraftPanel({ draft, disabled, submissionStarted }: Props) {
  const styles = useStyles();
  const intl = useIntl();
  const t = (key: string) => intl.formatMessage({ id: `mobile.draft.${key}` });
  const blocked = disabled || submissionStarted;
  const confirm = (kind: 'restore' | 'discard' | 'send' | 'clear', action: () => Promise<void>) => {
    Alert.alert(
      t(kind),
      t(`${kind}Confirm`),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t(kind),
          style: kind === 'discard' ? 'destructive' : 'default',
          onPress: () => void action(),
        },
      ],
      { cancelable: true },
    );
  };
  const status = draft.busy
    ? 'busy'
    : draft.scope.status !== 'ready'
      ? draft.scope.status
      : draft.presence === 'exists'
        ? 'exists'
        : draft.presence === 'submission-pending'
          ? 'submission-pending'
          : draft.presence === 'acknowledged'
            ? 'acknowledged'
            : draft.presence === 'error'
              ? 'failed'
              : 'none';
  return (
    <View style={styles.panel} testID="workout-draft-panel">
      <Text style={styles.title}>{t('title')}</Text>
      <Text style={styles.text} accessibilityLiveRegion="polite">
        {t(status)}
      </Text>
      <Text style={styles.hint}>{t('hint')}</Text>
      {draft.feedback && (draft.feedback !== 'failed' || draft.presence !== 'error') ? (
        <Text
          style={draft.feedback === 'invalid' ? styles.error : styles.text}
          accessibilityLiveRegion="polite"
        >
          {t(draft.feedback)}
        </Text>
      ) : null}
      {submissionStarted ? <Text style={styles.hint}>{t('submissionStarted')}</Text> : null}
      {draft.scope.status === 'ready' ? (
        <View style={styles.actions}>
          <Pressable
            testID="workout-draft-save"
            accessibilityRole="button"
            accessibilityState={{ disabled: blocked || !draft.canSave }}
            disabled={blocked || !draft.canSave}
            style={styles.button}
            onPress={() => void draft.save()}
          >
            <Text style={styles.buttonText}>{t('save')}</Text>
          </Pressable>
          {draft.presence === 'exists' || draft.presence === 'submission-pending' ? (
            <Pressable
              testID="workout-draft-restore"
              accessibilityRole="button"
              accessibilityState={{ disabled: blocked || !draft.canRestore }}
              disabled={blocked || !draft.canRestore}
              style={styles.button}
              onPress={() => confirm('restore', draft.restore)}
            >
              <Text style={styles.buttonText}>{t('restore')}</Text>
            </Pressable>
          ) : null}
          {draft.presence === 'error' ? (
            <Pressable
              testID="workout-draft-retry"
              accessibilityRole="button"
              accessibilityState={{ disabled: blocked || !draft.canRetry }}
              disabled={blocked || !draft.canRetry}
              style={styles.button}
              onPress={() => void draft.retry()}
            >
              <Text style={styles.buttonText}>{t('retry')}</Text>
            </Pressable>
          ) : null}
          {draft.canSend ? (
            <Pressable
              testID="workout-draft-send"
              accessibilityRole="button"
              accessibilityState={{ disabled: blocked }}
              disabled={blocked}
              style={styles.button}
              onPress={() => confirm('send', draft.confirmSend())}
            >
              <Text style={styles.buttonText}>
                {t(draft.presence === 'submission-pending' ? 'resend' : 'send')}
              </Text>
            </Pressable>
          ) : null}
          {!draft.online &&
          (draft.presence === 'exists' || draft.presence === 'submission-pending') ? (
            <Text style={styles.hint}>{t('offline')}</Text>
          ) : null}
          {draft.canClear ? (
            <Pressable
              testID="workout-draft-clear"
              accessibilityRole="button"
              accessibilityState={{ disabled: blocked }}
              disabled={blocked}
              style={styles.button}
              onPress={() => confirm('clear', draft.clear)}
            >
              <Text style={styles.buttonText}>{t('clear')}</Text>
            </Pressable>
          ) : null}
          {draft.canDiscard ? (
            <Pressable
              testID="workout-draft-discard"
              accessibilityRole="button"
              accessibilityState={{ disabled: blocked }}
              disabled={blocked}
              style={styles.button}
              onPress={() => confirm('discard', draft.discard)}
            >
              <Text style={styles.error}>{t('discard')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles((palette) =>
  StyleSheet.create({
    panel: {
      gap: 8,
      padding: 14,
      borderRadius: 12,
      backgroundColor: palette.surface,
      borderWidth: 1,
      borderColor: palette.border,
    },
    title: { fontSize: 16, fontWeight: '700', color: palette.text },
    text: { color: palette.text, fontSize: 14 },
    hint: { color: palette.muted, fontSize: 13 },
    error: { color: palette.error, fontWeight: '600', fontSize: 14 },
    actions: { gap: 8 },
    button: {
      minHeight: 44,
      padding: 12,
      borderWidth: 1,
      borderColor: palette.border,
      borderRadius: 12,
      justifyContent: 'center',
    },
    buttonText: { color: palette.primary, fontWeight: '600' },
  }),
);
