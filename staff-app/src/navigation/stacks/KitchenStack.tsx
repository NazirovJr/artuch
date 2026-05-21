import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import DrawerToggleButton from '../DrawerToggleButton';
import KitchenScreen from '../../screens/kitchen/KitchenScreen';
import { getHeaderStyle } from '../../theme';

type KitchenStackParamList = {
  Kitchen: undefined;
};

const Stack = createNativeStackNavigator<KitchenStackParamList>();

export default function KitchenStack() {
  const theme = useTheme();
  return (
    <Stack.Navigator screenOptions={getHeaderStyle(theme)}>
      <Stack.Screen
        name="Kitchen"
        component={KitchenScreen}
        options={{ title: 'Кухня', headerLeft: () => <DrawerToggleButton /> }}
      />
    </Stack.Navigator>
  );
}
