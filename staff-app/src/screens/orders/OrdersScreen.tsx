/**
 * OrdersScreen — adaptive list/detail composition for the orders flow.
 *
 * On phones the user keeps the classic stack flow: tap a card → push
 * `OrderDetail`. On tablet+ this wrapper hosts both the list and the
 * detail pane in a single SplitView; tapping a row updates a local
 * `selectedOrderId` and the detail pane swaps in place.
 *
 * `OrderListScreen` and `OrderDetailScreen` were extended with optional
 * props (`onSelectOrder` / `orderIdOverride`) so the same components
 * power both modes without duplication.
 */
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import OrderListScreen from './OrderListScreen';
import OrderDetailScreen from './OrderDetailScreen';
import SplitView from '../../components/layout/SplitView';
import EmptyState from '../../components/ui/EmptyState';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OrdersStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<OrdersStackParamList, 'OrderList'>;

export default function OrdersScreen(props: Props) {
  const { isTabletOrWider } = useBreakpoint();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // On phone, behave exactly like the old OrderListScreen: pushes
  // OrderDetail through the navigator. The wrapper is invisible.
  if (!isTabletOrWider) {
    return <OrderListScreen {...props} />;
  }

  const list = (
    <OrderListScreen
      {...props}
      onSelectOrder={setSelectedOrderId}
      selectedOrderId={selectedOrderId}
    />
  );

  const detail = selectedOrderId ? (
    <OrderDetailScreen {...(props as any)} orderIdOverride={selectedOrderId} />
  ) : null;

  const empty = (
    <View style={styles.empty}>
      <EmptyState
        icon="clipboard-text-outline"
        title="Выберите заказ"
        subtitle="Тапните карточку слева, чтобы посмотреть позиции и обновить статус."
      />
    </View>
  );

  return <SplitView list={list} detail={detail} emptyDetail={empty} />;
}

const styles = StyleSheet.create({
  empty: { flex: 1, justifyContent: 'center', padding: 24 },
});
