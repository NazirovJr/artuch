import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, Text } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import BarcodeInput from '../../components/BarcodeInput';
import ScreenContainer from '../../components/ui/ScreenContainer';
import {
  WarehouseItem,
  lookupItemByBarcode,
} from '../../api/warehouse-items';
import type { WarehouseStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<
  WarehouseStackParamList,
  'BarcodeLookup'
>;

export default function BarcodeLookupScreen({ route, navigation }: Props) {
  const { warehouseId, mode = 'income' } = route.params;
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<WarehouseItem | null>(null);
  const [notFound, setNotFound] = useState(false);

  const handleScan = async (barcode: string): Promise<boolean> => {
    setLastScanned(barcode);
    setNotFound(false);
    try {
      const item = await lookupItemByBarcode(barcode, warehouseId);
      if (!item) {
        setLastResult(null);
        setNotFound(true);
        return true; // resolved (just no match) — clear input
      }
      setLastResult(item);
      // Auto-navigate into the receive form prefilled with this item.
      navigation.replace('ReceiveStock', {
        warehouseId,
        itemId: item.id,
        mode,
      });
      return true;
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Сбой при поиске');
      return false;
    }
  };

  return (
    <ScreenContainer maxWidth="reading">
      <ScrollView contentContainerStyle={styles.body}>
        <Text variant="titleMedium" style={styles.title}>
          Сканируйте штрихкод
        </Text>
        <Text variant="bodySmall" style={styles.help}>
          USB/Bluetooth сканер просто отправляет код + Enter. Можно ввести
          вручную и нажать Done.
        </Text>
        <BarcodeInput onResolve={handleScan} />

        {lastScanned && (
          <Card mode="outlined" style={styles.resultCard}>
            <Card.Content>
              <Text variant="labelSmall">Последний код</Text>
              <Text variant="titleMedium">{lastScanned}</Text>
              {notFound && (
                <>
                  <HelperText type="error" visible style={styles.helper}>
                    Не найдено в этом складе. Создайте товар или назначьте ему
                    штрихкод.
                  </HelperText>
                  <Button
                    mode="contained-tonal"
                    icon="plus"
                    style={styles.createBtn}
                    onPress={() =>
                      navigation.navigate('NewWarehouseItem', {
                        warehouseId,
                        barcode: lastScanned ?? undefined,
                      })
                    }
                  >
                    Создать товар
                  </Button>
                </>
              )}
              {lastResult && (
                <Text style={styles.matched}>
                  → {lastResult.name} ({lastResult.quantity} {lastResult.unit})
                </Text>
              )}
            </Card.Content>
          </Card>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 12 },
  title: { fontWeight: '600' },
  help: { opacity: 0.7 },
  resultCard: { marginTop: 16 },
  matched: { marginTop: 8, fontWeight: '600' },
  helper: { paddingHorizontal: 0 },
  createBtn: { marginTop: 8, alignSelf: 'flex-start' },
});
