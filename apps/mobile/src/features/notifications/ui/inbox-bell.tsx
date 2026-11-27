import { useRouter } from 'expo-router';
import { useIntl } from 'react-intl';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { createThemedStyles, useMobileTheme } from '@/shared/config/theme-provider';

export function InboxBell({ count }: { count: number | undefined }) {
  const router = useRouter();
  const intl = useIntl();
  const styles = useStyles();
  const { palette } = useMobileTheme();
  const label =
    count === undefined
      ? intl.formatMessage({ id: 'mobile.notifications.title' })
      : intl.formatMessage({ id: 'mobile.notifications.bellLabel' }, { count });
  return (
    <Pressable
      testID="mobile-inbox-bell"
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.button}
      onPress={() => router.push('/notifications')}
    >
      <Svg width={24} height={24} viewBox="0 0 24 24" accessible={false}>
        <Path
          d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"
          fill="none"
          stroke={palette.text}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      {count !== undefined && count > 0 ? (
        <View
          style={styles.badge}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
const useStyles = createThemedStyles((palette) =>
  StyleSheet.create({
    button: {
      minWidth: 48,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    badge: {
      position: 'absolute',
      right: 0,
      top: 0,
      minWidth: 20,
      paddingHorizontal: 4,
      borderRadius: 10,
      backgroundColor: palette.primary,
    },
    badgeText: {
      color: palette.primaryForeground,
      fontSize: 11,
      fontWeight: '700',
      textAlign: 'center',
    },
  }),
);
