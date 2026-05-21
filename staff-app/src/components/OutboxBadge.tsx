import React, { useEffect, useState } from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import {
  drainOutbox,
  subscribeOutbox,
} from '../api/outbox';
import { getBaseUrl, getToken } from '../api/client';

interface Props {
  /** Optional press handler — falls back to manual drain. */
  onPress?: () => void;
}

/**
 * Compact indicator showing how many mutations are queued offline. Tap to
 * trigger a manual drain (useful when NetInfo lies — happens on iOS Wi-Fi
 * captive portals where state.isConnected says yes but the request still
 * fails until DNS settles).
 *
 * Renders nothing when there's nothing pending — out of sight, out of
 * mind on a normal-network day.
 */
export default function OutboxBadge({ onPress }: Props) {
  const theme = useTheme();
  const [count, setCount] = useState(0);
  const [draining, setDraining] = useState(false);

  useEffect(() => subscribeOutbox(setCount), []);

  if (count === 0 && !draining) return null;

  const handlePress = async () => {
    if (onPress) return onPress();
    setDraining(true);
    try {
      await drainOutbox(getBaseUrl(), getToken);
    } finally {
      setDraining(false);
    }
  };

  return (
    <TouchableOpacity onPress={handlePress}>
      <View
        style={[
          styles.badge,
          {
            backgroundColor: theme.colors.errorContainer,
            borderColor: theme.colors.error,
          },
        ]}
      >
        <Text
          variant="labelSmall"
          style={[styles.text, { color: theme.colors.onErrorContainer }]}
        >
          {draining
            ? '↻ Синхронизация…'
            : `Офлайн: ${count} в очереди`}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: { fontWeight: '600' },
});
