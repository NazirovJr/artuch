/**
 * AnimatedListItem — staggered fade/slide-in for list & grid rows.
 *
 * Wrap a FlatList/SectionList renderItem body. The delay is capped so long
 * lists don't wait seconds for the last row; reduce-motion users get no delay.
 */
import React from 'react';
import { type ViewStyle, type StyleProp } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

interface Props {
  index?: number;
  /** ms between consecutive items. */
  step?: number;
  /** Cap on how many items stagger before delay flattens. */
  maxStagger?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export default function AnimatedListItem({
  index = 0,
  step = 40,
  maxStagger = 12,
  style,
  children,
}: Props) {
  const delay = Math.min(index, maxStagger) * step;
  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(300).springify().damping(20)} style={style}>
      {children}
    </Animated.View>
  );
}
