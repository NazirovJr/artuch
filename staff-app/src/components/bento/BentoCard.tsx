/**
 * BentoCard — primitive for the role-aware Home dashboard.
 *
 * Bento layouts mix tile sizes (1x1, 2x1, 1x2, 2x2) so the eye lands on
 * what matters first. Use `size` to opt into a wider/taller tile; the
 * parent grid handles the actual flex math.
 *
 * Variants:
 *   - "neutral" — surface tone, default content card
 *   - "primary" — branded tone, hero KPIs
 *   - "accent"  — secondary tone, CTAs / highlights
 *   - "tonal"   — surfaceVariant, secondary metrics
 */
import React from 'react';
import { Pressable, View, StyleSheet, type ViewStyle } from 'react-native';
import Animated, {
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, Icon } from 'react-native-paper';
import { useAppTheme } from '../../hooks/useAppTheme';
import { spacing, shadows } from '../../theme/spacing';
import { radius } from '../../theme/shape';
import { useHaptics } from '../../hooks/useHaptics';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { rv, type ResponsiveValue } from '../../utils/responsive';
import AnimatedNumber from '../ui/AnimatedNumber';

export type BentoSize = 'sm' | 'md' | 'lg' | 'wide' | 'tall';
export type BentoTone = 'neutral' | 'primary' | 'accent' | 'tonal' | 'gradient';

export interface BentoCardProps {
  title: string;
  /** Big number or short string drawn in display-style */
  value?: string | number;
  /** When set, the value counts up to this number on mount (animated KPI). */
  numericValue?: number;
  /** Formats the animated number (money/percent/int). */
  format?: (n: number) => string;
  /** Smaller helper line below the value */
  subtitle?: string;
  icon?: string;
  size?: BentoSize;
  tone?: BentoTone;
  onPress?: () => void;
  /** Index into list — used to stagger the entry animation */
  delay?: number;
  /** Inline children for custom block bodies (charts, lists) */
  children?: React.ReactNode;
}

// Responsive flex-basis per tile size. On phones we keep the original 2-up
// layout; on tablets each tile shrinks to fit 3 across; on desktop/wide,
// 4 or 6 across so cards don't sprawl on FullHD windows.
//
// `wide` and `lg` tiles span the full row on phones but only ~half/two-thirds
// on larger screens — otherwise a single hero card consumes a 1920px row.
const SIZE_TO_FLEX: Record<
  BentoSize,
  { flexBasis: ResponsiveValue<string>; minHeight: number }
> = {
  sm: {
    flexBasis: { phone: '48%', tablet: '32%', desktop: '23%', wide: '15%' },
    minHeight: 110,
  },
  md: {
    flexBasis: { phone: '48%', tablet: '32%', desktop: '23%', wide: '15%' },
    minHeight: 150,
  },
  wide: {
    flexBasis: { phone: '100%', tablet: '66%', desktop: '49%', wide: '32%' },
    minHeight: 110,
  },
  tall: {
    flexBasis: { phone: '48%', tablet: '32%', desktop: '23%', wide: '15%' },
    minHeight: 220,
  },
  lg: {
    flexBasis: { phone: '100%', tablet: '66%', desktop: '49%', wide: '32%' },
    minHeight: 200,
  },
};

export default function BentoCard({
  title,
  value,
  numericValue,
  format,
  subtitle,
  icon,
  size = 'md',
  tone = 'neutral',
  onPress,
  delay = 0,
  children,
}: BentoCardProps) {
  const theme = useAppTheme();
  const haptics = useHaptics();
  const { bp } = useBreakpoint();

  // Press-scale micro-interaction (tactile feedback on tap).
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const { background, foreground, mutedForeground } = resolveTone(theme, tone);
  const sizing = SIZE_TO_FLEX[size];
  const flexBasis = rv(sizing.flexBasis, bp);
  const isGradient = tone === 'gradient';

  // Hero gradient + matching ink (dark on light amber / light on dark brown).
  const gradientColors = (theme.brand.tokens.gradientDawn2 as string[]);
  const gradientInk = theme.dark ? '#F0E9DC' : '#1B2433';
  const gradientMuted = theme.dark ? 'rgba(240,233,220,.7)' : 'rgba(27,36,51,.65)';

  const fg = isGradient ? gradientInk : foreground;
  const muted = isGradient ? gradientMuted : mutedForeground;

  const cardStyle: ViewStyle = {
    flexBasis: flexBasis as ViewStyle['flexBasis'],
    minHeight: sizing.minHeight,
    borderRadius: radius.bento,
    overflow: 'hidden',
    ...(isGradient ? shadows.md : shadows.sm),
    ...(isGradient ? null : { backgroundColor: background }),
    // Hairline border on neutral/tonal tiles for crisp edges on warm bg.
    ...(tone === 'neutral' || tone === 'tonal'
      ? { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.outlineVariant }
      : null),
  };

  const content = (
    <>
      <View style={styles.header}>
        {icon ? <Icon source={icon} size={22} color={fg} /> : null}
        <Text variant="labelLarge" style={[styles.title, { color: muted }]} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {numericValue !== undefined ? (
        <AnimatedNumber
          value={numericValue}
          format={format}
          style={[styles.numValue, { color: fg }]}
          numberOfLines={1}
        />
      ) : value !== undefined ? (
        <Text variant="displaySmall" style={[styles.value, { color: fg }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {subtitle ? (
        <Text variant="bodySmall" style={[styles.subtitle, { color: muted }]} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
      {children ? <View style={styles.children}>{children}</View> : null}
    </>
  );

  const body = onPress ? (
    <Pressable
      onPress={() => {
        haptics.light();
        onPress();
      }}
      onPressIn={() => {
        scale.value = withTiming(0.96, { duration: 120 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 180 });
      }}
      android_ripple={{ color: theme.colors.outlineVariant, borderless: false }}
      style={[styles.pressable, styles.body]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={[styles.body, styles.pressable]}>{content}</View>
  );

  return (
    <Animated.View
      entering={FadeInUp.delay(delay).springify().damping(18)}
      style={[cardStyle, pressStyle]}
    >
      {isGradient ? (
        <LinearGradient
          colors={gradientColors as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {body}
    </Animated.View>
  );
}

function resolveTone(theme: ReturnType<typeof useAppTheme>, tone: BentoTone) {
  switch (tone) {
    case 'primary':
      return {
        background: theme.colors.primary,
        foreground: theme.colors.onPrimary,
        mutedForeground: theme.colors.onPrimary,
      };
    case 'accent':
      return {
        background: theme.colors.secondaryContainer,
        foreground: theme.colors.onSecondaryContainer,
        mutedForeground: theme.colors.onSecondaryContainer,
      };
    case 'tonal':
      return {
        background: theme.colors.surfaceVariant,
        foreground: theme.colors.onSurface,
        mutedForeground: theme.colors.onSurfaceVariant,
      };
    case 'neutral':
    default:
      return {
        background: theme.colors.surface,
        foreground: theme.colors.onSurface,
        mutedForeground: theme.colors.onSurfaceVariant,
      };
  }
}

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
  },
  body: {
    flex: 1,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: {
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    opacity: 0.85,
  },
  value: {
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  numValue: {
    fontFamily: 'Unbounded-Bold',
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.5,
    marginTop: spacing.xs,
  },
  subtitle: {
    marginTop: spacing.xs,
    opacity: 0.85,
  },
  children: {
    marginTop: spacing.md,
    flex: 1,
  },
});
