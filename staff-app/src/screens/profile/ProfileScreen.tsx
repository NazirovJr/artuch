/**
 * ProfileScreen — user info + app preferences (theme, language, notifications).
 *
 * Lives outside the role-specific stacks so every user can reach it via the
 * drawer header. New preference keys go here so they're discoverable in one
 * place rather than scattered across feature screens.
 */
import React from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { Text, List, RadioButton, Divider } from 'react-native-paper';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useAuthStore } from '../../store/authStore';
import { useThemeMode, type ThemeMode } from '../../theme/ThemeProvider';
import { useHaptics } from '../../hooks/useHaptics';
import { spacing, borderRadius } from '../../theme/spacing';
import { useLanguage, type Lang } from '../../i18n';

const THEME_OPTIONS: { value: ThemeMode; label: string; description: string; icon: string }[] = [
  { value: 'system', label: 'Как в системе', description: 'Меняется вместе с настройкой устройства', icon: 'theme-light-dark' },
  { value: 'light', label: 'Светлая', description: 'Всегда светлая тема', icon: 'white-balance-sunny' },
  { value: 'dark', label: 'Тёмная', description: 'Всегда тёмная тема', icon: 'weather-night' },
];

const LANG_OPTIONS: { value: Lang; label: string; native: string }[] = [
  { value: 'ru', label: 'Русский', native: 'Русский' },
  { value: 'tg', label: 'Тоҷикӣ', native: 'Тоҷикӣ' },
  { value: 'en', label: 'English', native: 'English' },
];

export default function ProfileScreen() {
  const { user } = useAuthStore();
  const theme = useAppTheme();
  const { mode, setMode } = useThemeMode();
  const { lang, setLang } = useLanguage();
  const haptics = useHaptics();

  const handleSelect = async (next: ThemeMode) => {
    haptics.selection();
    await setMode(next);
  };

  const handleSelectLang = (next: Lang) => {
    haptics.selection();
    setLang(next);
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      {/* Header card */}
      <View
        style={[
          styles.headerCard,
          { backgroundColor: theme.colors.primaryContainer, borderRadius: borderRadius.lg },
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
          <Text style={[styles.avatarText, { color: theme.colors.onPrimary }]}>
            {(user?.fullName || '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text variant="titleLarge" style={{ color: theme.colors.onPrimaryContainer, fontWeight: '700' }}>
          {user?.fullName || ''}
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onPrimaryContainer, opacity: 0.8 }}>
          @{user?.username}
        </Text>
        <Text variant="labelMedium" style={{ color: theme.colors.onPrimaryContainer, opacity: 0.7, marginTop: 2 }}>
          {user?.role}
        </Text>
      </View>

      {/* Theme picker */}
      <List.Section>
        <List.Subheader style={{ color: theme.colors.onSurfaceVariant }}>Оформление</List.Subheader>
        {THEME_OPTIONS.map((opt, idx) => (
          <React.Fragment key={opt.value}>
            <List.Item
              title={opt.label}
              description={opt.description}
              left={(props) => <List.Icon {...props} icon={opt.icon} />}
              right={() => (
                <RadioButton
                  value={opt.value}
                  status={mode === opt.value ? 'checked' : 'unchecked'}
                  onPress={() => handleSelect(opt.value)}
                />
              )}
              onPress={() => handleSelect(opt.value)}
            />
            {idx < THEME_OPTIONS.length - 1 && <Divider />}
          </React.Fragment>
        ))}
      </List.Section>

      {/* Language picker */}
      <List.Section>
        <List.Subheader style={{ color: theme.colors.onSurfaceVariant }}>Язык</List.Subheader>
        {LANG_OPTIONS.map((opt, idx) => (
          <React.Fragment key={opt.value}>
            <List.Item
              title={opt.native}
              left={(props) => <List.Icon {...props} icon="translate" />}
              right={() => (
                <RadioButton
                  value={opt.value}
                  status={lang === opt.value ? 'checked' : 'unchecked'}
                  onPress={() => handleSelectLang(opt.value)}
                />
              )}
              onPress={() => handleSelectLang(opt.value)}
            />
            {idx < LANG_OPTIONS.length - 1 && <Divider />}
          </React.Fragment>
        ))}
      </List.Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  headerCard: {
    alignItems: 'center',
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
  },
});
