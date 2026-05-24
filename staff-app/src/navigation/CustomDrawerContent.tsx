import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import {
  DrawerContentScrollView,
  DrawerItemList,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { Text, Button, Divider } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { DrawerActions } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { logout } from '../api/auth';
import { onPrimaryOverlay } from '../theme/palette';
import { roleLabels } from '../theme/colors';
import { useAppTheme } from '../hooks/useAppTheme';
import { useHaptics } from '../hooks/useHaptics';

export default function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { user, reset } = useAuthStore();
  const theme = useAppTheme();
  const haptics = useHaptics();

  const handleLogout = async () => {
    haptics.heavy();
    await logout();
    reset();
  };

  const roleLabel = roleLabels[user?.role || ''] || user?.role || '';
  const gradientNight = theme.brand.tokens.gradientNight as string[];

  const openProfile = () => {
    haptics.light();
    props.navigation.dispatch(DrawerActions.jumpTo('HomeDrawer'));
    setTimeout(() => {
      props.navigation.navigate('HomeDrawer', { screen: 'Profile' });
    }, 80);
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={openProfile}
        android_ripple={{ color: onPrimaryOverlay.soft }}
      >
        <LinearGradient
          colors={gradientNight as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={[styles.avatar, { backgroundColor: onPrimaryOverlay.soft }]}>
            <Text style={[styles.avatarText, { color: '#FFFFFF' }]}>
              {(user?.fullName || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text variant="titleMedium" style={[styles.name, { color: '#FFFFFF' }]}>
            {user?.fullName}
          </Text>
          <Text variant="bodySmall" style={[styles.role, { color: onPrimaryOverlay.text }]}>
            {roleLabel}
          </Text>
        </LinearGradient>
      </Pressable>
      <Divider />

      <DrawerContentScrollView {...props} contentContainerStyle={styles.scrollContent}>
        <DrawerItemList {...props} />
      </DrawerContentScrollView>

      <Divider />
      <View style={styles.footer}>
        <Button
          mode="outlined"
          onPress={handleLogout}
          textColor={theme.colors.error}
          icon="logout"
          style={[styles.logoutButton, { borderColor: theme.colors.error }]}
        >
          Выйти
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 50,
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: 'bold',
  },
  name: {
    fontWeight: 'bold',
  },
  role: {
    marginTop: 4,
  },
  scrollContent: {
    paddingTop: 8,
  },
  footer: {
    padding: 16,
  },
  logoutButton: {
    borderRadius: 12,
  },
});
