import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import DrawerToggleButton from '../DrawerToggleButton';
import HomeScreen from '../../screens/home/HomeScreen';
import ProfileScreen from '../../screens/profile/ProfileScreen';
import { getHeaderStyle } from '../../theme';

export type HomeStackParamList = {
  Home: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeStack() {
  const theme = useTheme();
  return (
    <Stack.Navigator screenOptions={getHeaderStyle(theme)}>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Главная', headerLeft: () => <DrawerToggleButton /> }}
      />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Профиль' }} />
    </Stack.Navigator>
  );
}
