import React, { useEffect, useMemo } from 'react';
import {
  NavigationContainer,
  DefaultTheme as NavigationLightTheme,
  DarkTheme as NavigationDarkTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, StyleSheet } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import Animated, { FadeIn } from 'react-native-reanimated';
import LoginScreen from '../screens/auth/LoginScreen';
import MainDrawer from './MainDrawer';
import { useAuthStore } from '../store/authStore';
import { getMe } from '../api/auth';
import { getToken } from '../api/client';
import { useAppTheme } from '../hooks/useAppTheme';
import { useThemeMode } from '../theme/ThemeProvider';
import { onPrimaryOverlay } from '../theme/palette';
import type { RootStackParamList } from './types';

// Re-export all param list types so existing screen imports keep working
export type {
  RootStackParamList,
  POSStackParamList,
  OrdersStackParamList,
  RoomsStackParamList,
  CleaningStackParamList,
  WarehouseStackParamList,
  AdminStackParamList,
  DrawerParamList,
} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { isAuthenticated, isLoading, setUser, setLoading } = useAuthStore();

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (token) {
        try {
          const user = await getMe();
          setUser(user);
        } catch {
          // token expired or invalid
        }
      }
      setLoading(false);
    })();
  }, []);

  const theme = useAppTheme();
  const { scheme } = useThemeMode();

  // Compose React-Navigation theme from MD3 colours so the navigator's own
  // surfaces (drawer slide-in, header shadow region, blank space between
  // screens during a push) match the rest of the app.
  const navTheme = useMemo(() => {
    const base = scheme === 'dark' ? NavigationDarkTheme : NavigationLightTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.onSurface,
        border: theme.colors.outlineVariant,
        primary: theme.colors.primary,
      },
    };
  }, [scheme, theme]);

  if (isLoading) {
    return (
      <View style={[splashStyles.container, { backgroundColor: theme.colors.primary }]}>
        <Animated.View entering={FadeIn.duration(600)} style={splashStyles.content}>
          <View style={[splashStyles.logoCircle, { backgroundColor: theme.colors.onPrimary }]}>
            <Icon source="image-filter-hdr" size={56} color={theme.colors.primary} />
          </View>
          <Text variant="headlineMedium" style={[splashStyles.title, { color: theme.colors.onPrimary }]}>
            Artuch Travel
          </Text>
          <Text variant="bodyLarge" style={[splashStyles.subtitle, { color: onPrimaryOverlay.text }]}>
            Staff App
          </Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={MainDrawer} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const splashStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { alignItems: 'center' },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { fontWeight: 'bold' },
  subtitle: { marginTop: 4 },
});
