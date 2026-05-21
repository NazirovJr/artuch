import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, Surface, Icon, useTheme } from 'react-native-paper';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { login } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import { useT } from '../../i18n';
import { useHaptics } from '../../hooks/useHaptics';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuthStore();
  const theme = useTheme();
  const haptics = useHaptics();
  const t = useT();

  const handleLogin = async () => {
    if (!username || !password) return;
    setError('');
    setLoading(true);
    haptics.medium();
    try {
      const data = await login(username, password);
      haptics.success();
      setUser(data.user);
    } catch (e: any) {
      haptics.error();
      setError(e.message || t('auth.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.primary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Inner box clamps to 480px on iPad/web so the login card doesn't
          stretch across a 1920px monitor. On phones the parent's padding:24
          already wins over `width: 100%`. */}
      <View style={styles.contentClamp}>
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.brandingContainer}>
          <View style={[styles.logoCircle, { backgroundColor: theme.colors.onPrimary }]}>
            <Icon source="image-filter-hdr" size={48} color={theme.colors.primary} />
          </View>
          <Text variant="headlineLarge" style={[styles.brandTitle, { color: theme.colors.onPrimary }]}>
            Artuch Travel
          </Text>
          <Text variant="bodyLarge" style={[styles.brandSubtitle, { color: theme.colors.onPrimary }]}>
            Staff App
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200).springify()}>
          <Surface style={styles.card} elevation={4}>
          <Text variant="titleLarge" style={styles.title}>
            {t('auth.loginTitle')}
          </Text>

          <TextInput
            label={t('auth.username')}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            style={styles.input}
            mode="outlined"
            left={<TextInput.Icon icon="account" />}
          />
          <TextInput
            label={t('auth.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
            mode="outlined"
            left={<TextInput.Icon icon="lock" />}
          />

          {error ? (
            <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text>
          ) : null}

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            disabled={loading || !username || !password}
            style={styles.button}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
          >
            {t('auth.login')}
          </Button>
          </Surface>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  contentClamp: { width: '100%', maxWidth: 480 },
  brandingContainer: { alignItems: 'center', marginBottom: 32 },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  brandTitle: { fontWeight: 'bold', textAlign: 'center' },
  brandSubtitle: { opacity: 0.8, textAlign: 'center', marginTop: 4 },
  card: { padding: 24, borderRadius: 20 },
  title: { textAlign: 'center', marginBottom: 20, fontWeight: '600' },
  input: { marginBottom: 12 },
  error: { textAlign: 'center', marginBottom: 12 },
  button: { marginTop: 8, borderRadius: 12 },
  buttonContent: { paddingVertical: 6 },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
});
