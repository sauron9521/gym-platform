import { StyleSheet, Text, View } from 'react-native';

import { palette } from '@/shared/config/theme';

type StatusTileProps = {
  label: string;
  detail: string;
  status: 'Ready' | 'Planned';
};

export function StatusTile({ label, detail, status }: StatusTileProps) {
  return (
    <View style={styles.tile}>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.status}>{status}</Text>
      </View>
      <Text style={styles.detail}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: palette.text,
    fontWeight: '700',
    fontSize: 16,
  },
  status: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  detail: {
    color: palette.muted,
    fontSize: 14,
  },
});
