import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Icon, useTheme } from 'react-native-paper';
import { useAuthStore } from '../store/authStore';
import { useBreakpoint } from '../hooks/useBreakpoint';
import CustomDrawerContent from './CustomDrawerContent';

import HomeStack from './stacks/HomeStack';
import POSStack from './stacks/POSStack';
import OrdersStack from './stacks/OrdersStack';
import KitchenStack from './stacks/KitchenStack';
import RoomsStack from './stacks/RoomsStack';
import CleaningStack from './stacks/CleaningStack';
import WarehouseStack from './stacks/WarehouseStack';
import AdminStack from './stacks/AdminStack';

import type { DrawerParamList } from './types';

const Drawer = createDrawerNavigator<DrawerParamList>();

const DRAWER_ICONS: Record<string, string> = {
  HomeDrawer: 'view-dashboard-variant',
  POSDrawer: 'cash-register',
  OrdersDrawer: 'food-fork-drink',
  KitchenDrawer: 'pot-steam',
  RoomsDrawer: 'bed',
  CleaningDrawer: 'broom',
  WarehouseDrawer: 'warehouse',
  AdminDrawer: 'cog',
};

export default function MainDrawer() {
  const { user } = useAuthStore();
  const theme = useTheme();
  const { isTabletOrWider } = useBreakpoint();
  const role = user?.role || '';

  // Tablet+ (>=600dp): drawer becomes a permanent sidebar à la Slack/Notion.
  // The hamburger button is auto-hidden (the drawer is always visible) and
  // there's no overlay/dim. On phones we keep the classic slide-in drawer.
  const drawerType = isTabletOrWider ? 'permanent' : 'front';
  const defaultStatus = isTabletOrWider ? 'open' : 'closed';

  // `owner` is the business-level super-user and should see every drawer —
  // HomeScreen's role-aware bento already links owner blocks into these stacks.
  const isPrivileged = ['owner', 'admin', 'manager'].includes(role);
  const canPOS = isPrivileged || ['cashier', 'barman'].includes(role);
  const canOrders = isPrivileged || role === 'waiter';
  const canKitchen = isPrivileged || role === 'cook';
  const canRooms = isPrivileged || role === 'reception';
  const canCleaning = isPrivileged || role === 'cleaning';
  const canWarehouse = isPrivileged || role === 'warehouse-keeper';
  const canAdmin = isPrivileged;

  return (
    <Drawer.Navigator
      initialRouteName="HomeDrawer"
      defaultStatus={defaultStatus}
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType,
        overlayColor: isTabletOrWider ? 'transparent' : undefined,
        drawerStyle: {
          backgroundColor: theme.colors.background,
          width: 280,
          borderRightWidth: isTabletOrWider ? 1 : 0,
          borderRightColor: theme.colors.outlineVariant,
        },
        drawerActiveTintColor: theme.colors.primary,
        drawerActiveBackgroundColor: theme.colors.primaryContainer || '#DBEAFE',
        drawerInactiveTintColor: theme.colors.onSurfaceVariant,
        drawerLabelStyle: { fontSize: 15, fontWeight: '600', marginLeft: -8 },
        drawerItemStyle: { borderRadius: 12, marginHorizontal: 8, marginVertical: 2 },
      }}
    >
      <Drawer.Screen
        name="HomeDrawer"
        component={HomeStack}
        options={{ title: 'Главная', drawerIcon: ({ color, size }) => <Icon source={DRAWER_ICONS.HomeDrawer} size={size} color={color} /> }}
      />
      {canPOS && (
        <Drawer.Screen
          name="POSDrawer"
          component={POSStack}
          options={{ title: 'Касса', drawerIcon: ({ color, size }) => <Icon source={DRAWER_ICONS.POSDrawer} size={size} color={color} /> }}
        />
      )}
      {canOrders && (
        <Drawer.Screen
          name="OrdersDrawer"
          component={OrdersStack}
          options={{ title: 'Заказы', drawerIcon: ({ color, size }) => <Icon source={DRAWER_ICONS.OrdersDrawer} size={size} color={color} /> }}
        />
      )}
      {canKitchen && (
        <Drawer.Screen
          name="KitchenDrawer"
          component={KitchenStack}
          options={{ title: 'Кухня', drawerIcon: ({ color, size }) => <Icon source={DRAWER_ICONS.KitchenDrawer} size={size} color={color} /> }}
        />
      )}
      {canRooms && (
        <Drawer.Screen
          name="RoomsDrawer"
          component={RoomsStack}
          options={{ title: 'Номера', drawerIcon: ({ color, size }) => <Icon source={DRAWER_ICONS.RoomsDrawer} size={size} color={color} /> }}
        />
      )}
      {canCleaning && (
        <Drawer.Screen
          name="CleaningDrawer"
          component={CleaningStack}
          options={{ title: 'Уборка', drawerIcon: ({ color, size }) => <Icon source={DRAWER_ICONS.CleaningDrawer} size={size} color={color} /> }}
        />
      )}
      {canWarehouse && (
        <Drawer.Screen
          name="WarehouseDrawer"
          component={WarehouseStack}
          options={{ title: 'Склад', drawerIcon: ({ color, size }) => <Icon source={DRAWER_ICONS.WarehouseDrawer} size={size} color={color} /> }}
        />
      )}
      {canAdmin && (
        <Drawer.Screen
          name="AdminDrawer"
          component={AdminStack}
          options={{ title: 'Управление', drawerIcon: ({ color, size }) => <Icon source={DRAWER_ICONS.AdminDrawer} size={size} color={color} /> }}
        />
      )}
    </Drawer.Navigator>
  );
}
