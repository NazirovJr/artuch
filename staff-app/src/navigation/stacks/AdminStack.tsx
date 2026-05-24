import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import DrawerToggleButton from '../DrawerToggleButton';
import DashboardScreen from '../../screens/analytics/DashboardScreen';
import StaffListScreen from '../../screens/admin/StaffListScreen';
import StaffFormScreen from '../../screens/admin/StaffFormScreen';
import RoleListScreen from '../../screens/admin/RoleListScreen';
import OutletManagementScreen from '../../screens/admin/OutletManagementScreen';
import AuditLogScreen from '../../screens/admin/AuditLogScreen';
import FinanceScreen from '../../screens/admin/FinanceScreen';
import RevenueScreen from '../../screens/analytics/RevenueScreen';
import TopItemsScreen from '../../screens/analytics/TopItemsScreen';
import EmployeeStatsScreen from '../../screens/analytics/EmployeeStatsScreen';
import OwnerFeedScreen from '../../screens/admin/OwnerFeedScreen';
import ExceptionsScreen from '../../screens/admin/ExceptionsScreen';
import RoomTypeListScreen from '../../screens/admin/RoomTypeListScreen';
import RoomTypeFormScreen from '../../screens/admin/RoomTypeFormScreen';
import RoomFormScreen from '../../screens/admin/RoomFormScreen';
import RoomManagementScreen from '../../screens/admin/RoomManagementScreen';
import MenuManagementScreen from '../../screens/admin/MenuManagementScreen';
import MenuItemFormScreen from '../../screens/admin/MenuItemFormScreen';
import ExpenseListScreen from '../../screens/admin/ExpenseListScreen';
import ExpenseFormScreen from '../../screens/admin/ExpenseFormScreen';
import ExpenseCategoriesScreen from '../../screens/admin/ExpenseCategoriesScreen';
import ExpenseCategoryFormScreen from '../../screens/admin/ExpenseCategoryFormScreen';
import IncomeListScreen from '../../screens/admin/IncomeListScreen';
import IncomeFormScreen from '../../screens/admin/IncomeFormScreen';
import IncomeCategoriesScreen from '../../screens/admin/IncomeCategoriesScreen';
import IncomeCategoryFormScreen from '../../screens/admin/IncomeCategoryFormScreen';
import InventoryItemsScreen from '../../screens/admin/InventoryItemsScreen';
import AdminSettingsScreen from '../../screens/admin/AdminSettingsScreen';
import { getHeaderStyle } from '../../theme';
import type { AdminStackParamList } from '../types';

const Stack = createNativeStackNavigator<AdminStackParamList>();

export default function AdminStack() {
  const theme = useTheme();
  return (
    <Stack.Navigator screenOptions={getHeaderStyle(theme)}>
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Дашборд', headerLeft: () => <DrawerToggleButton /> }}
      />
      <Stack.Screen
        name="StaffList"
        component={StaffListScreen}
        options={{ title: 'Сотрудники' }}
      />
      <Stack.Screen
        name="StaffForm"
        component={StaffFormScreen}
        options={({ route }) => ({
          title: route.params?.userId ? 'Редактировать сотрудника' : 'Новый сотрудник',
        })}
      />
      <Stack.Screen name="RoleList" component={RoleListScreen} options={{ title: 'Роли' }} />
      <Stack.Screen
        name="OutletManagement"
        component={OutletManagementScreen}
        options={{ title: 'Точки продаж' }}
      />
      <Stack.Screen
        name="AuditLog"
        component={AuditLogScreen}
        options={{ title: 'Журнал действий' }}
      />
      <Stack.Screen name="Finance" component={FinanceScreen} options={{ title: 'Финансы' }} />
      <Stack.Screen name="Revenue" component={RevenueScreen} options={{ title: 'Выручка' }} />
      <Stack.Screen
        name="TopItems"
        component={TopItemsScreen}
        options={{ title: 'Популярные товары' }}
      />
      <Stack.Screen
        name="EmployeeStats"
        component={EmployeeStatsScreen}
        options={{ title: 'Статистика сотрудников' }}
      />
      <Stack.Screen
        name="OwnerFeed"
        component={OwnerFeedScreen}
        options={{ title: 'Лента владельца' }}
      />
      <Stack.Screen
        name="Exceptions"
        component={ExceptionsScreen}
        options={{ title: 'Исключения и потери' }}
      />
      <Stack.Screen
        name="RoomTypeList"
        component={RoomTypeListScreen}
        options={{ title: 'Типы комнат' }}
      />
      <Stack.Screen
        name="RoomTypeForm"
        component={RoomTypeFormScreen}
        options={({ route }) => ({
          title: route.params?.roomTypeId
            ? 'Редактировать тип'
            : 'Новый тип комнат',
        })}
      />
      <Stack.Screen
        name="RoomForm"
        component={RoomFormScreen}
        options={{ title: 'Создать комнаты' }}
      />
      <Stack.Screen
        name="RoomManagement"
        component={RoomManagementScreen}
        options={{ title: 'Управление комнатами' }}
      />
      <Stack.Screen
        name="MenuManagement"
        component={MenuManagementScreen}
        options={{ title: 'Меню' }}
      />
      <Stack.Screen
        name="MenuItemForm"
        component={MenuItemFormScreen}
        options={({ route }) => ({
          title: route.params?.itemId ? 'Редактировать позицию' : 'Новая позиция',
        })}
      />
      <Stack.Screen
        name="ExpenseList"
        component={ExpenseListScreen}
        options={{ title: 'Затраты' }}
      />
      <Stack.Screen
        name="ExpenseForm"
        component={ExpenseFormScreen}
        options={{ title: 'Новая затрата' }}
      />
      <Stack.Screen
        name="ExpenseCategories"
        component={ExpenseCategoriesScreen}
        options={{ title: 'Категории затрат' }}
      />
      <Stack.Screen
        name="ExpenseCategoryForm"
        component={ExpenseCategoryFormScreen}
        options={({ route }) => ({
          title: route.params?.categoryId ? 'Редактировать категорию' : 'Новая категория',
        })}
      />
      <Stack.Screen
        name="IncomeList"
        component={IncomeListScreen}
        options={{ title: 'Доходы' }}
      />
      <Stack.Screen
        name="IncomeForm"
        component={IncomeFormScreen}
        options={{ title: 'Новый доход' }}
      />
      <Stack.Screen
        name="IncomeCategories"
        component={IncomeCategoriesScreen}
        options={{ title: 'Категории доходов' }}
      />
      <Stack.Screen
        name="IncomeCategoryForm"
        component={IncomeCategoryFormScreen}
        options={({ route }) => ({
          title: route.params?.categoryId ? 'Редактировать категорию' : 'Новая категория',
        })}
      />
      <Stack.Screen
        name="InventoryItems"
        component={InventoryItemsScreen}
        options={{ title: 'POS → Склад' }}
      />
      <Stack.Screen
        name="AdminSettings"
        component={AdminSettingsScreen}
        options={{ title: 'Настройки компании' }}
      />
    </Stack.Navigator>
  );
}
