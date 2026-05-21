import React from 'react';
import { IconButton, useTheme } from 'react-native-paper';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useBreakpoint } from '../hooks/useBreakpoint';

export default function DrawerToggleButton() {
  const navigation = useNavigation();
  const theme = useTheme();
  const { isTabletOrWider } = useBreakpoint();

  // On tablet+ the drawer is permanent (see MainDrawer) — a hamburger
  // button would be a no-op and just clutter the header.
  if (isTabletOrWider) return null;

  return (
    <IconButton
      icon="menu"
      iconColor={theme.colors.onPrimary}
      size={24}
      onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
      style={{ marginLeft: 4 }}
    />
  );
}
