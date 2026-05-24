const IS_WEB = typeof window !== 'undefined' && typeof document !== 'undefined';

/**
 * Download a (binary) file from the backend and hand it to the user.
 *
 * Web: fetch → Blob → an <a download> click.
 * Native: expo-file-system's classic `downloadAsync` (it supports the
 *   Authorization header, unlike the new File API) writes to the cache dir,
 *   then expo-sharing opens the share sheet.
 *
 * Both expo modules are lazy-required with a graceful error so the rest of the
 * app keeps working in environments where they're unavailable (e.g. Expo Go).
 */
export async function downloadAndShareFile(
  url: string,
  token: string | null,
  filename: string,
  mimeType: string,
): Promise<void> {
  const headers: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  if (IS_WEB) {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Ошибка экспорта (HTTP ${res.status})`);
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
    return;
  }

  // Native — classic FS API (downloadAsync supports request headers).
  let FileSystem: any;
  try {
    FileSystem = require('expo-file-system/legacy');
  } catch {
    try {
      FileSystem = require('expo-file-system');
    } catch {
      throw new Error('Экспорт недоступен в этой сборке (нет expo-file-system)');
    }
  }
  const dir: string | undefined =
    FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!dir || typeof FileSystem.downloadAsync !== 'function') {
    throw new Error('Экспорт недоступен: обновите expo-file-system');
  }

  const fileUri = `${dir}${filename}`;
  const result = await FileSystem.downloadAsync(url, fileUri, { headers });
  const uri = result?.uri || fileUri;

  let Sharing: any;
  try {
    Sharing = require('expo-sharing');
  } catch {
    return; // file saved to cache; sharing unavailable — best effort
  }
  if (Sharing?.isAvailableAsync && (await Sharing.isAvailableAsync())) {
    await Sharing.shareAsync(uri, {
      mimeType,
      UTI: 'org.openxmlformats.spreadsheetml.sheet',
      dialogTitle: filename,
    });
  }
}

/**
 * Render an HTML document to PDF and hand it to the user (expo-print).
 * Web: opens the browser print/"Save as PDF" dialog. Native: writes a PDF
 * then opens the share sheet (falls back to the system print dialog).
 * Lazy-required so the app still runs where expo-print is unavailable.
 */
export async function printHtmlDocument(html: string, title: string): Promise<void> {
  let Print: any;
  try {
    Print = require('expo-print');
  } catch {
    throw new Error('Печать недоступна в этой сборке (нет expo-print)');
  }
  if (IS_WEB) {
    await Print.printAsync({ html });
    return;
  }
  const pdf = await Print.printToFileAsync({ html });
  let Sharing: any;
  try {
    Sharing = require('expo-sharing');
  } catch {
    Sharing = null;
  }
  if (Sharing?.isAvailableAsync && (await Sharing.isAvailableAsync())) {
    await Sharing.shareAsync(pdf.uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: title,
    });
  } else {
    await Print.printAsync({ uri: pdf.uri });
  }
}
