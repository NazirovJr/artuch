import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from 'react-native-paper';
import DrawerToggleButton from '../DrawerToggleButton';
import CleaningScreen from '../../screens/cleaning/CleaningScreen';
import CleaningDetailScreen from '../../screens/cleaning/CleaningDetailScreen';
import CleaningTaskDetailScreen from '../../screens/cleaning/CleaningTaskDetailScreen';
import CleaningInspectionScreen from '../../screens/cleaning/CleaningInspectionScreen';
import { getHeaderStyle } from '../../theme';
import type { CleaningStackParamList } from '../types';

const Stack = createNativeStackNavigator<CleaningStackParamList>();

export default function CleaningStack() {
  const theme = useTheme();
  return (
    <Stack.Navigator screenOptions={getHeaderStyle(theme)}>
      <Stack.Screen
        name="CleaningList"
        component={CleaningScreen}
        options={{ title: 'Уборка номеров', headerLeft: () => <DrawerToggleButton /> }}
      />
      <Stack.Screen
        name="CleaningDetail"
        component={CleaningDetailScreen}
        options={{ title: 'Детали уборки' }}
      />
      <Stack.Screen
        name="CleaningTaskDetail"
        component={CleaningTaskDetailScreen}
        options={{ title: 'Задача уборки' }}
      />
      <Stack.Screen
        name="CleaningInspection"
        component={CleaningInspectionScreen}
        options={{ title: 'Инспекция уборки' }}
      />
    </Stack.Navigator>
  );
}
