import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import DrawerToggleButton from '../DrawerToggleButton';
import BarKdsScreen from '../../screens/kitchen/BarKdsScreen';
import BarHomeScreen from '../../screens/bar/BarHomeScreen';
import BarSaleScreen from '../../screens/bar/BarSaleScreen';
import BarReceiveScreen from '../../screens/bar/BarReceiveScreen';
import BarChecksScreen from '../../screens/bar/BarChecksScreen';
import BarCheckDetailScreen from '../../screens/bar/BarCheckDetailScreen';
import BarQuickAddScreen from '../../screens/bar/BarQuickAddScreen';
import BarSettlementScreen from '../../screens/bar/BarSettlementScreen';
import AddRoundScreen from '../../screens/checks/AddRoundScreen';
import { getHeaderStyle } from '../../theme';
import type { BarStackParamList } from '../types';

const Stack = createNativeStackNavigator<BarStackParamList>();

export default function BarStack() {
  const theme = useTheme();
  return (
    <Stack.Navigator screenOptions={getHeaderStyle(theme)}>
      <Stack.Screen
        name="BarHome"
        component={BarHomeScreen}
        options={{ title: 'Бар', headerLeft: () => <DrawerToggleButton /> }}
      />
      <Stack.Screen name="Bar" component={BarKdsScreen} options={{ title: 'Задачи' }} />
      <Stack.Screen name="BarSale" component={BarSaleScreen} options={{ title: 'Продажа' }} />
      <Stack.Screen name="BarReceive" component={BarReceiveScreen} options={{ title: 'Получить со склада' }} />
      <Stack.Screen name="BarChecks" component={BarChecksScreen} options={{ title: 'Счета бара' }} />
      <Stack.Screen name="BarCheckDetail" component={BarCheckDetailScreen} options={{ title: 'Счёт' }} />
      <Stack.Screen
        name="BarAddRound"
        component={AddRoundScreen as any}
        options={{ title: 'Добавить из меню' }}
      />
      <Stack.Screen name="BarQuickAdd" component={BarQuickAddScreen} options={{ title: 'Добавить напрямую' }} />
      <Stack.Screen name="BarSettlement" component={BarSettlementScreen} options={{ title: 'Оплата' }} />
    </Stack.Navigator>
  );
}
