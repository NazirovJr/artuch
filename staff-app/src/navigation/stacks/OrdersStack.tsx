import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import OrdersScreen from '../../screens/orders/OrdersScreen';
import NewOrderScreen from '../../screens/orders/NewOrderScreen';
import OrderDetailScreen from '../../screens/orders/OrderDetailScreen';
import DrawerToggleButton from '../DrawerToggleButton';
import { getHeaderStyle } from '../../theme';
import type { OrdersStackParamList } from '../types';

const Stack = createNativeStackNavigator<OrdersStackParamList>();

export default function OrdersStack() {
  const theme = useTheme();
  return (
    <Stack.Navigator screenOptions={getHeaderStyle(theme)}>
      <Stack.Screen
        name="OrderList"
        component={OrdersScreen}
        options={{ title: 'Заказы', headerLeft: () => <DrawerToggleButton /> }}
      />
      <Stack.Screen name="NewOrder" component={NewOrderScreen} options={{ title: 'Новый заказ' }} />
      <Stack.Screen
        name="OrderDetail"
        component={OrderDetailScreen}
        options={{ title: 'Детали заказа' }}
      />
    </Stack.Navigator>
  );
}
