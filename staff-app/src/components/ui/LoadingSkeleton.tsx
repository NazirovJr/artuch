import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { useEffect } from 'react';

function SkeletonCard({ index, variant }: { index: number; variant: 'card' | 'row' }) {
  const theme = useTheme();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(
      index * 100,
      withRepeat(withTiming(1, { duration: 800 }), -1, true),
    );
  }, [index, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (variant === 'row') {
    return (
      <Animated.View
        style={[
          styles.row,
          { backgroundColor: theme.colors.surfaceVariant },
          animatedStyle,
        ]}
      />
    );
  }

  return (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: theme.colors.surfaceVariant },
        animatedStyle,
      ]}
    >
      <View style={[styles.cardLine, { backgroundColor: theme.colors.outline, width: '60%' }]} />
      <View style={[styles.cardLine, { backgroundColor: theme.colors.outline, width: '40%' }]} />
      <View style={[styles.cardLine, { backgroundColor: theme.colors.outline, width: '80%' }]} />
    </Animated.View>
  );
}

interface LoadingSkeletonProps {
  count?: number;
  variant?: 'card' | 'row';
}

export default function LoadingSkeleton({ count = 4, variant = 'card' }: LoadingSkeletonProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} index={i} variant={variant} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    height: 100,
    justifyContent: 'center',
  },
  cardLine: {
    height: 12,
    borderRadius: 6,
    marginBottom: 8,
    opacity: 0.3,
  },
  row: {
    borderRadius: 8,
    height: 56,
    marginBottom: 8,
  },
});
