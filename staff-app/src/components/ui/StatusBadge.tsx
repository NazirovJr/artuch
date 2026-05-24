import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { statusColorsByDomain, statusLabelsByDomain } from '../../theme/colors';
import { withAlpha, readableInk } from '../../utils/color';
import { useAppTheme } from '../../hooks/useAppTheme';

interface StatusBadgeProps {
  status: string;
  domain: 'order' | 'room' | 'cleaning' | 'reservation' | 'folio' | 'rental' | 'transaction' | 'role';
  style?: ViewStyle;
  /** Hide the leading dot (e.g. in dense rows). */
  noDot?: boolean;
}

/**
 * Soft-tonal status pill (Mountain Dawn): tinted background + coloured ink +
 * a leading dot. The hue comes from the per-domain status maps; the tint and
 * a readable ink shade are derived at runtime so every domain looks uniform.
 */
export default function StatusBadge({ status, domain, style, noDot }: StatusBadgeProps) {
  const theme = useAppTheme();
  const colors = statusColorsByDomain[domain] || {};
  const labels = statusLabelsByDomain[domain] || {};
  const base = colors[status] || theme.colors.outline;
  const label = labels[status] || status;

  const bg = withAlpha(base, theme.dark ? 0.24 : 0.16);
  const ink = theme.dark ? base : readableInk(base);

  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      {!noDot && <View style={[styles.dot, { backgroundColor: base }]} />}
      <Text style={[styles.label, { color: ink }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Onest-SemiBold',
  },
});
