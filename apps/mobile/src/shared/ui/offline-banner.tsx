import { useNetworkState } from 'expo-network';
import { StyleSheet, Text, View } from 'react-native';

import { isConnectionAvailable } from '@/shared/api/network-state';

export function OfflineBanner() {
  const network = useNetworkState();
  if (isConnectionAvailable(network)) return null;

  return (
    <View accessibilityRole="alert" style={styles.banner} pointerEvents="none">
      <Text style={styles.text}>Немає мережі. Зміни тренування не надсилатимуться.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#7f1d1d',
    padding: 12,
    zIndex: 30,
  },
  text: { fontSize: 13, color: '#ffffff', textAlign: 'center', fontWeight: '600' },
});
