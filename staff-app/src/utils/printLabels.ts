/**
 * Print barcode labels via expo-print (optional dependency, same guarded
 * require as the folio receipt). Builds the offline Code128 label sheet and
 * opens the system print dialog (or browser print on web/Electron).
 */
import { renderBarcodeLabelsHtml, type LabelItem } from './barcodeLabelHtml';

export async function printBarcodeLabels(items: LabelItem[]): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  let Print: any;
  try {
    Print = require('expo-print');
  } catch {
    throw new Error('expo-print не установлен (npx expo install expo-print)');
  }
  const html = renderBarcodeLabelsHtml(items);
  await Print.printAsync({ html });
}
