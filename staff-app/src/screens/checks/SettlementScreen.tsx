import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import {
  Card,
  Text,
  Button,
  SegmentedButtons,
  List,
  RadioButton,
  Divider,
  useTheme,
} from 'react-native-paper';
import { getCheck, settleCheck, type TableCheck } from '../../api/checks';
import { getFolios } from '../../api/folios';
import { useToast } from '../../components/ui/Toast';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OrdersStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<OrdersStackParamList, 'Settlement'>;
type Method = 'cash' | 'card' | 'folio';

export default function SettlementScreen({ route, navigation }: Props) {
  const { checkId } = route.params;
  const theme = useTheme();
  const toast = useToast();

  const [check, setCheck] = useState<TableCheck | null>(null);
  const [method, setMethod] = useState<Method>('cash');
  const [folios, setFolios] = useState<any[]>([]);
  const [folioId, setFolioId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getCheck(checkId).then(setCheck).catch(() => {});
  }, [checkId]);

  useEffect(() => {
    if (method === 'folio' && folios.length === 0) {
      getFolios('open').then(setFolios).catch(() => {});
    }
  }, [method, folios.length]);

  const printReceipt = useCallback(async (c: TableCheck) => {
    let Print: any;
    try {
      Print = require('expo-print');
    } catch {
      return; // optional dependency; skip silently
    }
    const rows = (c.orders || [])
      .flatMap((o) => o.items || [])
      .filter((i) => i.status !== 'cancelled')
      .map(
        (i) =>
          `<tr><td>${i.menuItemName} ×${i.quantity}</td><td style="text-align:right">${(Number(i.menuItemPrice) * i.quantity).toFixed(2)}</td></tr>`,
      )
      .join('');
    const html = `<html><head><meta charset="utf-8"><style>
      body{font-family:-apple-system,Roboto,sans-serif;padding:16px;color:#111}
      h2{margin:0 0 4px} .muted{color:#666;font-size:12px}
      table{width:100%;border-collapse:collapse;margin-top:12px;font-size:14px}
      td{padding:4px 0;border-bottom:1px solid #eee}
      .total{font-size:18px;font-weight:bold;margin-top:12px;text-align:right}
    </style></head><body>
      <h2>Artuch — Ресторан</h2>
      <div class="muted">Счёт #${c.checkNumber} · Стол ${c.tableNumber}</div>
      <table>${rows}</table>
      <div class="total">Итого: ${Number(c.total).toFixed(2)} TJS</div>
    </body></html>`;
    try {
      await Print.printAsync({ html });
    } catch {
      // user cancelled print dialog — ignore
    }
  }, []);

  const handleSettle = useCallback(async () => {
    if (method === 'folio' && !folioId) {
      toast.show('Выберите фолио гостя', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const closed = await settleCheck(checkId, {
        method,
        folioId: method === 'folio' ? folioId! : undefined,
      });
      toast.show('Счёт оплачен', 'success');
      await printReceipt(closed);
      navigation.popToTop();
    } catch (e: any) {
      toast.show(e.message || 'Не удалось оплатить', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [method, folioId, checkId, navigation, toast, printReceipt]);

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
            <View style={styles.totalRow}>
              <Text variant="titleMedium">Стол {check.tableNumber} · счёт #{check.checkNumber}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text variant="headlineMedium" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
                {Number(check.total).toFixed(2)} TJS
              </Text>
            </View>
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

        {method === 'cash' && (
          <Text style={[styles.muted, styles.hint]}>
            Наличная оплата запишется на вашу открытую смену.
          </Text>
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
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { marginBottom: 8, marginLeft: 4, opacity: 0.7 },
  segments: { marginBottom: 12 },
  muted: { opacity: 0.6 },
  hint: { marginHorizontal: 4 },
  footer: { padding: 12, borderTopWidth: 1 },
  payBtn: { borderRadius: 8, paddingVertical: 4 },
});
