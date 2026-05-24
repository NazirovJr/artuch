import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import CheckListScreen from '../../screens/checks/CheckListScreen';
import CheckDetailScreen from '../../screens/checks/CheckDetailScreen';
import AddRoundScreen from '../../screens/checks/AddRoundScreen';
import SettlementScreen from '../../screens/checks/SettlementScreen';
import DrawerToggleButton from '../DrawerToggleButton';
import { getHeaderStyle } from '../../theme';
import type { OrdersStackParamList } from '../types';

const Stack = createNativeStackNavigator<OrdersStackParamList>();

export default function OrdersStack() {
  const theme = useTheme();
  return (
    <Stack.Navigator screenOptions={getHeaderStyle(theme)}>
      <Stack.Screen
        name="CheckList"
        component={CheckListScreen}
        options={{ title: 'Столы', headerLeft: () => <DrawerToggleButton /> }}
      />
      <Stack.Screen name="CheckDetail" component={CheckDetailScreen} options={{ title: 'Счёт' }} />
      <Stack.Screen name="AddRound" component={AddRoundScreen} options={{ title: 'Новый заказ' }} />
      <Stack.Screen name="Settlement" component={SettlementScreen} options={{ title: 'Оплата' }} />
    </Stack.Navigator>
  );
}
