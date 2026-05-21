import React from 'react';
import { Badge } from 'react-native-paper';
import { StyleSheet, type ViewStyle } from 'react-native';
import { statusColorsByDomain, statusLabelsByDomain } from '../../theme/colors';

interface StatusBadgeProps {
  status: string;
  domain: 'order' | 'room' | 'cleaning' | 'reservation' | 'folio' | 'rental' | 'transaction' | 'role';
  style?: ViewStyle;
}

export default function StatusBadge({ status, domain, style }: StatusBadgeProps) {
  const colors = statusColorsByDomain[domain] || {};
  const labels = statusLabelsByDomain[domain] || {};
  const bg = colors[status] || '#6B7280';
  const label = labels[status] || status;

  return (
    <Badge style={[styles.badge, { backgroundColor: bg }, style]}>
      {label}
    </Badge>
  );
}

const styles = StyleSheet.create({
  badge: {
    color: '#fff',
    paddingHorizontal: 8,
    fontSize: 12,
    alignSelf: 'flex-start',
  },
});
