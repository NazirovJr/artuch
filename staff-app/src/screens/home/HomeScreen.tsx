/**
 * HomeScreen — role-aware bento dashboard, the landing screen for every user.
 *
 * Why one screen for all roles instead of N: shared layout, scrolling,
 * pull-to-refresh, KPI fetch logic. The role only changes *which blocks*
 * appear and where they navigate. Adding a new role is a single entry in
 * `getBlocksFor()`.
 *
 * Data: hits `/v2/analytics/kpi` once on mount + on pull-to-refresh.
 * Per-block extra fetches happen inside each block component if needed.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, RefreshControl } from 'react-native';
import { Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { DrawerActions } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import { useAppTheme } from '../../hooks/useAppTheme';
import { getKpi } from '../../api/analytics';
import { spacing } from '../../theme/spacing';
import { contentMaxWidth } from '../../theme/breakpoints';
import { BentoSection } from '../../components/bento/BentoGrid';
import BentoCard from '../../components/bento/BentoCard';
import { getBlocksFor, type BlockSpec, type Kpi } from './roleBlocks';

export default function HomeScreen() {
  const { user } = useAuthStore();
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const [kpi, setKpi] = useState<Kpi | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadKpi = useCallback(async () => {
    try {
      const data = await getKpi();
      setKpi(data);
    } catch {
      // KPI is best-effort — blocks render placeholders if data is missing.
    }
  }, []);

  useEffect(() => {
    loadKpi();
  }, [loadKpi]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadKpi();
    setRefreshing(false);
  }, [loadKpi]);

  const role = user?.role || 'unknown';
  const greeting = greetingForHour(new Date().getHours());
  const sections = getBlocksFor(role, kpi);

  const handleBlockPress = useCallback(
    (spec: BlockSpec) => {
      if (!spec.target) return;
      // Drawer routes need to open the drawer first; nested screens use navigate.
      navigation.dispatch(DrawerActions.jumpTo(spec.target.drawer));
      if (spec.target.screen) {
        // Slight delay so the drawer transition reads first, then push the inner screen.
        setTimeout(() => {
          navigation.navigate(spec.target!.drawer, { screen: spec.target!.screen });
        }, 80);
      }
    },
    [navigation],
  );

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Center the dashboard on wide screens — phones see no effect (content
          already <= 1400dp), tablet/desktop/web get a comfortable max width
          so bento cards don't sprawl across a 1920px monitor. */}
      <View style={[styles.inner, { maxWidth: contentMaxWidth.grid }]}>
        {/* Greeting header */}
        <View style={styles.greeting}>
          <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {greeting},
          </Text>
          <Text variant="headlineMedium" style={{ color: theme.colors.onSurface, fontWeight: '700' }}>
            {user?.fullName || ''}
          </Text>
        </View>

        {sections.map((section, sIdx) => (
          <BentoSection key={section.title || sIdx} title={section.title} subtitle={section.subtitle}>
            {section.blocks.map((block, bIdx) => (
              <BentoCard
                key={block.title}
                title={block.title}
                value={block.value}
                subtitle={block.subtitle}
                icon={block.icon}
                size={block.size}
                tone={block.tone}
                delay={bIdx * 60}
                onPress={block.target ? () => handleBlockPress(block) : undefined}
              />
            ))}
          </BentoSection>
        ))}
      </View>
    </ScrollView>
  );
}

function greetingForHour(hour: number): string {
  if (hour < 5) return 'Доброй ночи';
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    alignItems: 'center', // centers `inner` horizontally on wide screens
  },
  inner: {
    width: '100%',
  },
  greeting: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
});
