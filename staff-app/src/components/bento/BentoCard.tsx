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
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Text, Icon } from 'react-native-paper';
import { useAppTheme } from '../../hooks/useAppTheme';
import { spacing, borderRadius, shadows } from '../../theme/spacing';
import { useHaptics } from '../../hooks/useHaptics';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { rv, type ResponsiveValue } from '../../utils/responsive';

export type BentoSize = 'sm' | 'md' | 'lg' | 'wide' | 'tall';
export type BentoTone = 'neutral' | 'primary' | 'accent' | 'tonal';

export interface BentoCardProps {
  title: string;
  /** Big number or short string drawn in display-style */
  value?: string | number;
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

  const { background, foreground, mutedForeground } = resolveTone(theme, tone);
  const sizing = SIZE_TO_FLEX[size];
  const flexBasis = rv(sizing.flexBasis, bp);

  const cardStyle: ViewStyle = {
    flexBasis: flexBasis as ViewStyle['flexBasis'],
    minHeight: sizing.minHeight,
    backgroundColor: background,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  };

  const content = (
    <>
      <View style={styles.header}>
        {icon ? <Icon source={icon} size={22} color={foreground} /> : null}
        <Text variant="labelLarge" style={[styles.title, { color: mutedForeground }]} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {value !== undefined ? (
        <Text variant="displaySmall" style={[styles.value, { color: foreground }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {subtitle ? (
        <Text variant="bodySmall" style={[styles.subtitle, { color: mutedForeground }]} numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
      {children ? <View style={styles.children}>{children}</View> : null}
    </>
  );

  return (
    <Animated.View entering={FadeInUp.delay(delay).springify().damping(18)} style={cardStyle}>
      {onPress ? (
        <Pressable
          onPress={() => {
            haptics.light();
            onPress();
          }}
          android_ripple={{ color: theme.colors.outlineVariant, borderless: false }}
          style={styles.pressable}
        >
          {content}
        </Pressable>
      ) : (
        content
      )}
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
  subtitle: {
    marginTop: spacing.xs,
    opacity: 0.85,
  },
  children: {
    marginTop: spacing.md,
    flex: 1,
  },
});
