/**
 * BookingGroupStatementScreen — printable preview of a booking-group's
 * master statement (rooms + folio charges + totals).
 *
 * Mirrors `FolioReceiptScreen`: same WebView preview + print/share story,
 * same lazy-import-with-fallback approach for `expo-print` / `expo-sharing`
 * / `react-native-webview` so a missing peer dep degrades to a hint
 * instead of crashing the screen.
 *
 * Data flow: `GET /booking-groups/:id/statement` returns a structured
 * payload with totals already computed server-side; we just hand it to
 * `renderBookingGroupStatementHtml`.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { Button, Text } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RoomsStackParamList } from '../../navigation/types';
import {
  BookingGroupStatement,
  getBookingGroupStatement,
} from '../../api/booking-groups';
import { renderBookingGroupStatementHtml } from '../../utils/bookingGroupStatementHtml';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useToast } from '../../components/ui/Toast';
import { useHaptics } from '../../hooks/useHaptics';

type Props = NativeStackScreenProps<
  RoomsStackParamList,
  'BookingGroupStatement'
>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Print: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Sharing: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let WebViewComp: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Print = require('expo-print');
} catch {
  Print = null;
}
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Sharing = require('expo-sharing');
} catch {
  Sharing = null;
}
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    WebViewComp = require('react-native-webview').WebView;
  } catch {
    WebViewComp = null;
  }
}

export default function BookingGroupStatementScreen({
  route,
  navigation,
}: Props) {
  const { groupId } = route.params;
  const theme = useAppTheme();
  const toast = useToast();
  const haptics = useHaptics();

  const [data, setData] = useState<BookingGroupStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getBookingGroupStatement(groupId);
      setData(s);
    } catch (e: any) {
      toast.error('Не удалось загрузить выписку', e?.message);
    } finally {
      setLoading(false);
    }
  }, [groupId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const html = useMemo(() => {
    if (!data) return '';
    return renderBookingGroupStatementHtml({
      group: data.group,
      reservations: data.reservations,
      folio: data.folio,
      issuedAt: data.issuedAt,
    });
  }, [data]);

  const handlePrint = async () => {
    if (!html) return;
    if (!Print) {
      toast.warning(
        'Установите expo-print',
        'npx expo install expo-print expo-sharing',
      );
      return;
    }
    setPrinting(true);
    try {
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
      } else {
        const pdf = await Print.printToFileAsync({ html });
        if (Sharing && (await Sharing.isAvailableAsync())) {
          await Sharing.shareAsync(pdf.uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Счёт группы ${data?.group.code ?? ''}`,
            UTI: 'com.adobe.pdf',
          });
        } else {
          await Print.printAsync({ uri: pdf.uri });
        }
      }
      haptics.success();
    } catch (e: any) {
      toast.error('Ошибка печати', e?.message || 'Неизвестная ошибка');
    } finally {
      setPrinting(false);
    }
  };

  if (loading) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <ActivityIndicator />
      </View>
    );
  }

  if (!data) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <Text>Группа не найдена</Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.webviewWrapper}>
        <StatementPreview html={html} />
      </View>
      <View style={styles.actions}>
        <Button
          mode="contained"
          icon="printer"
          onPress={handlePrint}
          loading={printing}
          disabled={printing}
          style={styles.actionButton}
        >
          Скачать / Печать PDF
        </Button>
        <Button
          mode="text"
          onPress={() => navigation.goBack()}
          style={styles.actionButton}
        >
          Назад к группе
        </Button>
      </View>
    </View>
  );
}

function StatementPreview({ html }: { html: string }) {
  if (Platform.OS === 'web') {
    return React.createElement('iframe', {
      srcDoc: html,
      sandbox: 'allow-same-origin',
      style: {
        flex: 1,
        border: 0,
        width: '100%',
        height: '100%',
        backgroundColor: '#FFFFFF',
      },
      title: 'Счёт группы',
    });
  }

  if (WebViewComp) {
    return (
      <WebViewComp
        originWhitelist={['*']}
        source={{ html }}
        style={{ flex: 1, backgroundColor: '#FFFFFF' }}
        bounces={false}
      />
    );
  }

  return (
    <View style={styles.fallback}>
      <Text
        variant="titleMedium"
        style={{ textAlign: 'center', marginBottom: 8 }}
      >
        Для предпросмотра установите WebView
      </Text>
      <Text variant="bodySmall" style={{ textAlign: 'center', opacity: 0.7 }}>
        npx expo install react-native-webview{'\n'}
        Печать в PDF работает без предпросмотра.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  webviewWrapper: { flex: 1, backgroundColor: '#FFFFFF' },
  fallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  actions: {
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  actionButton: { borderRadius: 10 },
});
