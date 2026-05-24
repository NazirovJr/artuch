/**
 * FolioReceiptScreen — full-screen preview of a guest folio receipt with
 * three actions: Print/Save PDF, Email to guest, Back to list.
 *
 * Entered automatically after `closeFolio` succeeds (from FolioDetail at
 * zero balance, or from CloseFolioScreen after paying out the remainder),
 * and manually from FolioDetail when viewing an already-closed folio.
 *
 * Rendering strategy:
 *   - `renderFolioReceiptHtml` builds a self-contained HTML document.
 *   - `<WebView source={{ html }} />` displays it on iOS/Android.
 *   - On web, where react-native-webview renders as an `<iframe srcdoc>`,
 *     the same HTML works without changes.
 *   - Print/PDF: `Print.printAsync` (all platforms) opens the system dialog;
 *     on mobile we additionally call `printToFileAsync` + `Sharing` for a
 *     "save / share PDF" flow. On web the native print dialog already
 *     offers "Save as PDF".
 *   - Email: POST to `/v2/folios/:id/email-receipt` with the same HTML.
 *
 * Data fetching: grabs the folio (with charges) and the linked guest in
 * parallel. A missing guest just hides guest-specific rows — it doesn't
 * block the rest.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { Button, SegmentedButtons, Text } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RoomsStackParamList } from '../../navigation/types';
import { getFolio, emailFolioReceipt } from '../../api/folios';
import { getGuest } from '../../api/guests';
import { getSettings, type SystemSettings } from '../../api/settings';
import { renderFolioReceiptHtml } from '../../utils/folioReceiptHtml';
import { renderFolioInvoiceHtml, buildInvoiceLines } from '../../utils/folioInvoiceHtml';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useToast } from '../../components/ui/Toast';
import { useHaptics } from '../../hooks/useHaptics';
import { useAuthStore } from '../../store/authStore';

type Props = NativeStackScreenProps<RoomsStackParamList, 'FolioReceipt'>;

// Optional peer packages — resolve lazily so the screen still mounts if
// `expo install expo-print expo-sharing react-native-webview` hasn't been
// run yet. In that case the UI falls back gracefully:
//   - `expo-print` missing → Print button shows an install hint toast.
//   - `expo-sharing` missing → Print goes straight to system print dialog.
//   - `react-native-webview` missing → preview renders as `<iframe>` on
//     web (always works), or as a plain "install webview" note on native.
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

export default function FolioReceiptScreen({ route, navigation }: Props) {
  const { folioId } = route.params;
  const theme = useAppTheme();
  const toast = useToast();
  const haptics = useHaptics();
  const user = useAuthStore((s) => s.user);

  const [folio, setFolio] = useState<any>(null);
  const [guest, setGuest] = useState<any>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [mode, setMode] = useState<'receipt' | 'invoice'>('receipt');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [folioData, settingsData] = await Promise.allSettled([
        getFolio(folioId),
        getSettings(),
      ]);
      const resolvedFolio = folioData.status === 'fulfilled' ? folioData.value : null;
      setFolio(resolvedFolio);
      if (settingsData.status === 'fulfilled') {
        setSettings(settingsData.value);
      }
      if (resolvedFolio?.guestId) {
        // Separate call (not joined on the backend) — cheap and keeps the
        // folio endpoint focused. A missing guest is non-fatal.
        try {
          const g = await getGuest(resolvedFolio.guestId);
          setGuest(g);
        } catch {
          setGuest(null);
        }
      }
      if (folioData.status === 'rejected') {
        toast.error('Не удалось загрузить фолио', (folioData.reason as any)?.message);
      }
    } catch (e: any) {
      toast.error('Не удалось загрузить фолио', e?.message);
    } finally {
      setLoading(false);
    }
  }, [folioId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const receiptHtml = useMemo(() => {
    if (!folio) return '';
    return renderFolioReceiptHtml({
      folio,
      guest,
      charges: folio.charges ?? [],
      // Reservation info is not embedded in the folio response today;
      // when /v2/folios/:id starts joining `reservation`, it will appear
      // here automatically.
      reservation: folio.reservation ?? null,
    });
  }, [folio, guest]);

  const invoiceHtml = useMemo(() => {
    if (!folio) return '';
    const invoiceLines = buildInvoiceLines(
      folio.charges ?? [],
      { roomNumber: folio.roomNumber, openedAt: folio.openedAt, closedAt: folio.closedAt },
    );
    return renderFolioInvoiceHtml({
      folio: {
        invoiceNumber: folio.invoiceNumber,
        roomNumber: folio.roomNumber,
        openedAt: folio.openedAt,
        closedAt: folio.closedAt,
        totalAmount: folio.totalAmount,
        paidAmount: folio.paidAmount,
      },
      guest: guest ? {
        firstName: guest.firstName,
        lastName: guest.lastName,
        nationality: guest.nationality,
      } : undefined,
      lines: invoiceLines,
      administrator: user?.fullName,
      hotel: settings ? {
        name: settings.hotelName ?? undefined,
        address: settings.hotelAddress ?? undefined,
        phone: settings.hotelPhone ?? undefined,
        email: settings.hotelEmail ?? undefined,
        logoUrl: settings.logoUrl ?? undefined,
        currency: settings.currency ?? undefined,
      } : undefined,
    });
  }, [folio, guest, settings, user]);

  const html = mode === 'invoice' ? invoiceHtml : receiptHtml;

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
        // On web, printAsync opens the browser print dialog with the HTML
        // pre-loaded; "Save as PDF" is one of the built-in destinations.
        await Print.printAsync({ html });
      } else {
        // Mobile: render to a PDF file first, then offer the native share
        // sheet (AirDrop, mail, Files.app, etc). If Sharing is unavailable,
        // fall back to printAsync which opens the system print panel.
        const pdf = await Print.printToFileAsync({ html });
        if (Sharing && (await Sharing.isAvailableAsync())) {
          await Sharing.shareAsync(pdf.uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Чек по фолио',
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

  const handleEmail = async () => {
    if (!html) return;
    if (!guest?.email) {
      toast.warning('У гостя не указан email');
      return;
    }
    setSending(true);
    try {
      const subject =
        mode === 'invoice'
          ? `Счет № ${folio?.invoiceNumber ?? ''} — ${Number(folio?.totalAmount ?? 0).toFixed(2)} TJS`
          : `Чек по фолио — ${Number(folio?.totalAmount ?? 0).toFixed(2)} TJS`;
      const res = await emailFolioReceipt(folioId, {
        html,
        subject,
      });
      haptics.success();
      toast.success('Чек отправлен', res?.to || guest.email);
    } catch (e: any) {
      toast.error('Не удалось отправить', e?.message || 'Попробуйте позже');
    } finally {
      setSending(false);
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

  if (!folio) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <Text>Фолио не найдено</Text>
      </View>
    );
  }

  const hasEmail = !!guest?.email;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.modeToggle}>
        <SegmentedButtons
          value={mode}
          onValueChange={(v) => setMode(v as 'receipt' | 'invoice')}
          buttons={[
            { value: 'receipt', label: 'Квитанция', icon: 'receipt' },
            { value: 'invoice', label: 'Накладная (Счёт)', icon: 'file-document-outline' },
          ]}
          density="small"
        />
      </View>
      <View style={styles.webviewWrapper}>
        <ReceiptPreview html={html} />
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
          mode="outlined"
          icon="email-send"
          onPress={handleEmail}
          loading={sending}
          disabled={sending || !hasEmail}
          style={styles.actionButton}
        >
          {hasEmail ? 'Отправить на email' : 'Нет email у гостя'}
        </Button>
        <Button
          mode="text"
          onPress={() => navigation.popToTop()}
          style={styles.actionButton}
        >
          К списку фолио
        </Button>
      </View>
    </View>
  );
}

/**
 * Cross-platform HTML preview.
 *   - Web: plain `<iframe srcDoc>` — zero deps, perfect fidelity.
 *   - Native with react-native-webview installed: WebView with the html source.
 *   - Native without webview: a text fallback telling the user to install it;
 *     Print/Email still work because they build PDF/email from the same HTML
 *     directly without needing the preview.
 */
function ReceiptPreview({ html }: { html: string }) {
  if (Platform.OS === 'web') {
    // Render via React DOM (react-native-web passes through unknown tags).
    // `srcDoc` embeds the HTML directly; `sandbox` prevents scripts from
    // running (our template has none, but defence in depth).
    return React.createElement('iframe', {
      srcDoc: html,
      sandbox: 'allow-same-origin',
      style: { flex: 1, border: 0, width: '100%', height: '100%', backgroundColor: '#FFFFFF' },
      title: 'Чек по фолио',
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
      <Text variant="titleMedium" style={{ textAlign: 'center', marginBottom: 8 }}>
        Для предпросмотра чека установите WebView
      </Text>
      <Text variant="bodySmall" style={{ textAlign: 'center', opacity: 0.7 }}>
        npx expo install react-native-webview{'\n'}
        Печать и отправка на email работают без предпросмотра.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modeToggle: { padding: 10, paddingBottom: 4 },
  webviewWrapper: { flex: 1, backgroundColor: '#FFFFFF' },
  fallback: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  actions: {
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  actionButton: { borderRadius: 10 },
});
