/**
 * FoliosScreen — adaptive list/detail composition for guest folios.
 *
 * Phone: same UX as before — tapping a folio pushes FolioDetail.
 * Tablet+: SplitView with the list pinned left and the detail in the
 * right pane that swaps on selection.
 *
 * Both inner components were extended with optional callback / override
 * props so they keep working as standalone Stack.Screens too.
 */
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import FolioListScreen from './FolioListScreen';
import FolioDetailScreen from './FolioDetailScreen';
import SplitView from '../../components/layout/SplitView';
import EmptyState from '../../components/ui/EmptyState';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RoomsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RoomsStackParamList, 'FolioList'>;

export default function FoliosScreen(props: Props) {
  const { isTabletOrWider } = useBreakpoint();
  const [selectedFolioId, setSelectedFolioId] = useState<string | null>(null);

  if (!isTabletOrWider) {
    return <FolioListScreen {...props} />;
  }

  const list = (
    <FolioListScreen
      {...props}
      onSelectFolio={setSelectedFolioId}
      selectedFolioId={selectedFolioId}
    />
  );

  const detail = selectedFolioId ? (
    <FolioDetailScreen {...(props as any)} folioIdOverride={selectedFolioId} />
  ) : null;

  const empty = (
    <View style={styles.empty}>
      <EmptyState
        icon="file-document-outline"
        title="Выберите фолио"
        subtitle="Тапните карточку слева, чтобы посмотреть начисления и платежи."
      />
    </View>
  );

  return <SplitView list={list} detail={detail} emptyDetail={empty} />;
}

const styles = StyleSheet.create({
  empty: { flex: 1, justifyContent: 'center', padding: 24 },
});
