import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import DrawerToggleButton from '../DrawerToggleButton';
import { getHeaderStyle } from '../../theme';
import ReservationsScreen from '../../screens/reservations/ReservationsScreen';
import NewReservationScreen from '../../screens/reservations/NewReservationScreen';
import ReservationDetailScreen from '../../screens/reservations/ReservationDetailScreen';
import ReservationCalendarScreen from '../../screens/reservations/ReservationCalendarScreen';
import GuestFormNavScreen from '../../screens/reservations/GuestFormNavScreen';
import RoomsScreen from '../../screens/reception/RoomsScreen';
import FoliosScreen from '../../screens/folio/FoliosScreen';
import FolioDetailScreen from '../../screens/folio/FolioDetailScreen';
import FolioCreateScreen from '../../screens/folio/FolioCreateScreen';
import AddChargeScreen from '../../screens/folio/AddChargeScreen';
import CloseFolioScreen from '../../screens/folio/CloseFolioScreen';
import FolioReceiptScreen from '../../screens/folio/FolioReceiptScreen';
import BookingGroupListScreen from '../../screens/reception/BookingGroupListScreen';
import BookingGroupFormScreen from '../../screens/reception/BookingGroupFormScreen';
import BookingGroupDetailScreen from '../../screens/reception/BookingGroupDetailScreen';
import BookingGroupStatementScreen from '../../screens/reception/BookingGroupStatementScreen';
import type { RoomsStackParamList } from '../types';

const Stack = createNativeStackNavigator<RoomsStackParamList>();

export default function RoomsStack() {
  const theme = useTheme();
  return (
    <Stack.Navigator screenOptions={getHeaderStyle(theme)}>
      <Stack.Screen
        name="ReservationList"
        component={ReservationsScreen}
        options={{ title: 'Бронирования', headerLeft: () => <DrawerToggleButton /> }}
      />
      <Stack.Screen
        name="RoomGrid"
        component={RoomsScreen}
        options={{ title: 'Номера' }}
      />
      <Stack.Screen
        name="ReservationCalendar"
        component={ReservationCalendarScreen}
        options={{ title: 'Календарь броней' }}
      />
      <Stack.Screen
        name="NewReservation"
        component={NewReservationScreen}
        options={{ title: 'Новое бронирование' }}
      />
      <Stack.Screen
        name="ReservationDetail"
        component={ReservationDetailScreen}
        options={{ title: 'Детали бронирования' }}
      />
      <Stack.Screen
        name="GuestForm"
        component={GuestFormNavScreen}
        options={{ title: 'Новый гость' }}
      />
      <Stack.Screen
        name="FolioList"
        component={FoliosScreen}
        options={{ title: 'Фолио гостей' }}
      />
      <Stack.Screen
        name="FolioDetail"
        component={FolioDetailScreen}
        options={{ title: 'Детали фолио' }}
      />
      <Stack.Screen
        name="FolioCreate"
        component={FolioCreateScreen}
        options={{ title: 'Новое фолио' }}
      />
      <Stack.Screen
        name="AddCharge"
        component={AddChargeScreen}
        options={({ route }) => ({
          title:
            route.params?.mode === 'payment'
              ? 'Оплата'
              : route.params?.mode === 'discount'
                ? 'Скидка'
                : route.params?.mode === 'deposit'
                  ? 'Депозит'
                  : 'Начисление',
        })}
      />
      <Stack.Screen
        name="FolioClose"
        component={CloseFolioScreen}
        options={{ title: 'Закрытие фолио' }}
      />
      <Stack.Screen
        name="FolioReceipt"
        component={FolioReceiptScreen}
        options={{ title: 'Чек по фолио' }}
      />
      <Stack.Screen
        name="BookingGroupList"
        component={BookingGroupListScreen}
        options={{ title: 'Группы бронирования' }}
      />
      <Stack.Screen
        name="BookingGroupForm"
        component={BookingGroupFormScreen}
        options={({ route }) => ({
          title: route.params?.groupId ? 'Редактировать группу' : 'Новая группа',
        })}
      />
      <Stack.Screen
        name="BookingGroupDetail"
        component={BookingGroupDetailScreen}
        options={{ title: 'Группа' }}
      />
      <Stack.Screen
        name="BookingGroupStatement"
        component={BookingGroupStatementScreen}
        options={{ title: 'Счёт группы' }}
      />
    </Stack.Navigator>
  );
}
