import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import DrawerToggleButton from '../DrawerToggleButton';
import WarehouseListScreen from '../../screens/warehouse/WarehouseListScreen';
import WarehouseDetailScreen from '../../screens/warehouse/WarehouseDetailScreen';
import NewWarehouseItemScreen from '../../screens/warehouse/NewWarehouseItemScreen';
import ReceiveStockScreen from '../../screens/warehouse/ReceiveStockScreen';
import BarcodeLookupScreen from '../../screens/warehouse/BarcodeLookupScreen';
import StockMovementsScreen from '../../screens/warehouse/StockMovementsScreen';
import LowStockAlertsScreen from '../../screens/warehouse/LowStockAlertsScreen';
import ExpiringLotsScreen from '../../screens/warehouse/ExpiringLotsScreen';
import StockReportsScreen from '../../screens/warehouse/StockReportsScreen';
import UnitConversionsScreen from '../../screens/warehouse/UnitConversionsScreen';
import SuppliersScreen from '../../screens/warehouse/SuppliersScreen';
import TransferListScreen from '../../screens/warehouse/TransferListScreen';
import NewTransferScreen from '../../screens/warehouse/NewTransferScreen';
import ReceiveTransferScreen from '../../screens/warehouse/ReceiveTransferScreen';
import StocktakeListScreen from '../../screens/warehouse/StocktakeListScreen';
import StocktakeDetailScreen from '../../screens/warehouse/StocktakeDetailScreen';
import RentalListScreen from '../../screens/rentals/RentalListScreen';
import NewRentalScreen from '../../screens/rentals/NewRentalScreen';
import RentalDetailScreen from '../../screens/rentals/RentalDetailScreen';
import ReturnRentalScreen from '../../screens/rentals/ReturnRentalScreen';
import { getHeaderStyle } from '../../theme';
import type { WarehouseStackParamList } from '../types';

const Stack = createNativeStackNavigator<WarehouseStackParamList>();

export default function WarehouseStack() {
  const theme = useTheme();
  return (
    <Stack.Navigator screenOptions={getHeaderStyle(theme)}>
      <Stack.Screen
        name="WarehouseList"
        component={WarehouseListScreen}
        options={{ title: 'Склады', headerLeft: () => <DrawerToggleButton /> }}
      />
      <Stack.Screen
        name="WarehouseDetail"
        component={WarehouseDetailScreen}
        options={{ title: 'Склад' }}
      />
      <Stack.Screen
        name="NewWarehouseItem"
        component={NewWarehouseItemScreen}
        options={{ title: 'Новый товар' }}
      />
      <Stack.Screen
        name="ReceiveStock"
        component={ReceiveStockScreen}
        options={{ title: 'Операция' }}
      />
      <Stack.Screen
        name="BarcodeLookup"
        component={BarcodeLookupScreen}
        options={{ title: 'Сканировать' }}
      />
      <Stack.Screen
        name="StockMovements"
        component={StockMovementsScreen}
        options={{ title: 'Журнал движений' }}
      />
      <Stack.Screen
        name="LowStockAlerts"
        component={LowStockAlertsScreen}
        options={{ title: 'Низкий остаток' }}
      />
      <Stack.Screen
        name="ExpiringLots"
        component={ExpiringLotsScreen}
        options={{ title: 'Истекающие партии' }}
      />
      <Stack.Screen
        name="StockReports"
        component={StockReportsScreen}
        options={{ title: 'Отчёты' }}
      />
      <Stack.Screen
        name="UnitConversions"
        component={UnitConversionsScreen}
        options={{ title: 'Конверсии единиц' }}
      />
      <Stack.Screen
        name="Suppliers"
        component={SuppliersScreen}
        options={{ title: 'Поставщики' }}
      />
      <Stack.Screen
        name="TransferList"
        component={TransferListScreen}
        options={{ title: 'Перемещения' }}
      />
      <Stack.Screen
        name="NewTransfer"
        component={NewTransferScreen}
        options={{ title: 'Новое перемещение' }}
      />
      <Stack.Screen
        name="ReceiveTransfer"
        component={ReceiveTransferScreen}
        options={{ title: 'Принять' }}
      />
      <Stack.Screen
        name="StocktakeList"
        component={StocktakeListScreen}
        options={{ title: 'Инвентаризации' }}
      />
      <Stack.Screen
        name="StocktakeDetail"
        component={StocktakeDetailScreen}
        options={{ title: 'Инвентаризация' }}
      />
      <Stack.Screen name="RentalList" component={RentalListScreen} options={{ title: 'Аренда' }} />
      <Stack.Screen
        name="NewRental"
        component={NewRentalScreen}
        options={{ title: 'Новая аренда' }}
      />
      <Stack.Screen
        name="RentalDetail"
        component={RentalDetailScreen}
        options={{ title: 'Детали аренды' }}
      />
      <Stack.Screen
        name="ReturnRental"
        component={ReturnRentalScreen}
        options={{ title: 'Возврат аренды' }}
      />
    </Stack.Navigator>
  );
}
