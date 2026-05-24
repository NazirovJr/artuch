import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ScreenContainer from '../../components/ui/ScreenContainer';
import type { BarStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<BarStackParamList, 'BarHome'>;

const TILES = [
  { key: 'kds', label: 'Задачи (KDS)', icon: 'view-dashboard', color: '#2563EB' },
  { key: 'receive', label: 'Получить со склада', icon: 'warehouse', color: '#7C3AED' },
  { key: 'sell', label: 'Продать', icon: 'cash-register', color: '#059669' },
  { key: 'checks', label: 'Счета бара', icon: 'receipt', color: '#D97706' },
] as const;

export default function BarHomeScreen({ navigation }: Props) {
  const theme = useTheme();

  const handleTile = useCallback(
    (key: string) => {
      switch (key) {
        case 'kds':     navigation.navigate('Bar');        break;
        case 'receive': navigation.navigate('BarReceive'); break;
        case 'sell':    navigation.navigate('BarSale');    break;
        case 'checks':  navigation.navigate('BarChecks');  break;
      }
    },
    [navigation],
  );

  return (
    <ScreenContainer>
      <View style={styles.grid}>
        {TILES.map((tile) => (
          <Card
            key={tile.key}
            style={[styles.tile, { backgroundColor: theme.colors.surface }]}
            onPress={() => handleTile(tile.key)}
            elevation={2}
          >
            <Card.Content style={styles.tileContent}>
              <View style={[styles.icon, { backgroundColor: tile.color + '22' }]}>
                <MaterialCommunityIcons name={tile.icon as any} size={32} color={tile.color} />
              </View>
              <Text variant="titleSmall" style={styles.tileLabel} numberOfLines={2}>
                {tile.label}
              </Text>
            </Card.Content>
          </Card>
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 12,
  },
  tile: {
    width: '47%',
    borderRadius: 14,
  },
  tileContent: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  icon: {
    borderRadius: 14,
    padding: 10,
  },
  tileLabel: {
    textAlign: 'center',
    fontWeight: '600',
  },
});
