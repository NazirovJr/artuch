import React, { type ReactNode } from 'react';
import { type ViewStyle } from 'react-native';
import { Card } from 'react-native-paper';
import Animated, { FadeInUp } from 'react-native-reanimated';

interface AnimatedCardProps {
  index: number;
  children: ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}

export default function AnimatedCard({ index, children, style, onPress }: AnimatedCardProps) {
  return (
    <Animated.View entering={FadeInUp.delay(index * 50).springify()}>
      <Card style={style} onPress={onPress}>
        {children}
      </Card>
    </Animated.View>
  );
}
