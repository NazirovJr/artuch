import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import POSScreen from '../../screens/pos/POSScreen';
import CartScreen from '../../screens/pos/CartScreen';
import FolioPickerScreen from '../../screens/pos/FolioPickerScreen';
import ReceiptScreen from '../../screens/pos/ReceiptScreen';
import TransactionHistoryScreen from '../../screens/pos/TransactionHistoryScreen';
import RefundScreen from '../../screens/pos/RefundScreen';
import ShiftOpenScreen from '../../screens/pos/ShiftOpenScreen';
import ShiftCloseScreen from '../../screens/pos/ShiftCloseScreen';
import DrawerToggleButton from '../DrawerToggleButton';
import { getHeaderStyle } from '../../theme';
import type { POSStackParamList } from '../types';

const Stack = createNativeStackNavigator<POSStackParamList>();

export default function POSStack() {
  const theme = useTheme();
  return (
    <Stack.Navigator screenOptions={getHeaderStyle(theme)}>
      <Stack.Screen
        name="POS"
        component={POSScreen}
        options={{ title: 'Касса', headerLeft: () => <DrawerToggleButton /> }}
      />
      <Stack.Screen name="Cart" component={CartScreen} options={{ title: 'Корзина' }} />
      <Stack.Screen
        name="FolioPicker"
        component={FolioPickerScreen}
        options={{ title: 'Выбрать счёт' }}
      />
      <Stack.Screen name="Receipt" component={ReceiptScreen} options={{ title: 'Чек' }} />
      <Stack.Screen
        name="TransactionHistory"
        component={TransactionHistoryScreen}
        options={{ title: 'История продаж' }}
      />
      <Stack.Screen name="Refund" component={RefundScreen} options={{ title: 'Возврат' }} />
      <Stack.Screen
        name="ShiftOpen"
        component={ShiftOpenScreen}
        options={{ title: 'Открыть смену' }}
      />
      <Stack.Screen
        name="ShiftClose"
        component={ShiftCloseScreen}
        options={{ title: 'Закрыть смену' }}
      />
    </Stack.Navigator>
  );
}
