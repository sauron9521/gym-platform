import { useNetworkState } from 'expo-network';
import { StyleSheet, Text, View } from 'react-native';

import { createThemedStyles } from '@/shared/config/theme-provider';
import { isConnectionAvailable } from '@/shared/api/network-state';

export function OfflineBanner() {
  const styles = useStyles();
  const network = useNetworkState();
  if (isConnectionAvailable(network)) return null;

  return (
    <View accessibilityRole="alert" style={styles.banner} pointerEvents="none">
      <Text style={styles.text}>Немає мережі. Зміни тренування не надсилатимуться.</Text>
    </View>
  );
}

const useStyles = createThemedStyles((palette) =>
  StyleSheet.create({
    banner: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: palette.error,
      padding: 12,
      zIndex: 30,
    },
    text: { fontSize: 13, color: palette.errorForeground, textAlign: 'center', fontWeight: '600' },
  }),
);
