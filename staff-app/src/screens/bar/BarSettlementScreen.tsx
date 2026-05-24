import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import {
  Card, Text, Button, SegmentedButtons, RadioButton, useTheme,
} from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getCheck, settleCheck, type TableCheck } from '../../api/checks';
import { getFolios } from '../../api/folios';
import { getOutlets } from '../../api/outlets';
import { useToast } from '../../components/ui/Toast';
import type { BarStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<BarStackParamList, 'BarSettlement'>;
type Method = 'cash' | 'card' | 'folio';

export default function BarSettlementScreen({ route, navigation }: Props) {
  const { checkId } = route.params;
  const theme = useTheme();
  const toast = useToast();

  const [check, setCheck] = useState<TableCheck | null>(null);
  const [method, setMethod] = useState<Method>('cash');
  const [folios, setFolios] = useState<any[]>([]);
  const [folioId, setFolioId] = useState<string | null>(null);
  const [barOutletId, setBarOutletId] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getCheck(checkId).then(setCheck).catch(() => {});
    getOutlets()
      .then((outlets) => {
        const bar = outlets.find((o) => o.type === 'bar');
        if (bar) setBarOutletId(bar.id);
      })
      .catch(() => {});
  }, [checkId]);

  useEffect(() => {
    if (method === 'folio' && folios.length === 0) {
      getFolios('open').then(setFolios).catch(() => {});
    }
  }, [method, folios.length]);

  const handleSettle = useCallback(async () => {
    if (method === 'folio' && !folioId) {
      toast.show('Выберите фолио гостя', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await settleCheck(checkId, {
        method,
        folioId: method === 'folio' ? folioId! : undefined,
        outletId: barOutletId,
      });
      toast.show('Счёт оплачен', 'success');
      navigation.popToTop();
    } catch (e: any) {
      toast.show(e.message || 'Не удалось оплатить', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [method, folioId, checkId, barOutletId, navigation, toast]);

  if (!check) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Text>Загрузка…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium">Стол {check.tableNumber} · счёт #{check.checkNumber}</Text>
            <Text variant="headlineMedium" style={{ color: theme.colors.primary, fontWeight: 'bold', marginTop: 4 }}>
              {Number(check.total).toFixed(2)} TJS
            </Text>
          </Card.Content>
        </Card>

        <Text variant="titleSmall" style={styles.label}>Способ оплаты</Text>
        <SegmentedButtons
          value={method}
          onValueChange={(v) => setMethod(v as Method)}
          buttons={[
            { value: 'cash', label: 'Наличные', icon: 'cash' },
            { value: 'card', label: 'Карта', icon: 'credit-card' },
            { value: 'folio', label: 'На номер', icon: 'bed' },
          ]}
          style={styles.segments}
        />

        {method === 'folio' && (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleSmall" style={{ marginBottom: 4 }}>Фолио гостя</Text>
              {folios.length === 0 ? (
                <Text style={styles.muted}>Нет открытых фолио</Text>
              ) : (
                <RadioButton.Group onValueChange={setFolioId} value={folioId || ''}>
                  {folios.map((f) => (
                    <RadioButton.Item
                      key={f.id}
                      label={`${f.roomNumber ? `Номер ${f.roomNumber}` : 'Фолио'} · ${Number(f.totalAmount).toFixed(0)} TJS`}
                      value={f.id}
                    />
                  ))}
                </RadioButton.Group>
              )}
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: theme.colors.outlineVariant }]}>
        <Button
          mode="contained"
          icon="check"
          loading={submitting}
          disabled={submitting || (method === 'folio' && !folioId)}
          onPress={handleSettle}
          style={styles.payBtn}
        >
          Оплатить {Number(check.total).toFixed(2)} TJS
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 12 },
  card: { borderRadius: 12, marginBottom: 12 },
  label: { marginBottom: 8, marginLeft: 4, opacity: 0.7 },
  segments: { marginBottom: 12 },
  muted: { opacity: 0.6 },
  footer: { padding: 12, borderTopWidth: 1 },
  payBtn: { borderRadius: 8, paddingVertical: 4 },
});
