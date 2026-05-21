import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, IconButton, TextInput } from 'react-native-paper';

interface Props {
  /**
   * Resolves the scanned/typed code to a result. Caller decides how to act
   * (prefill form, navigate, etc.). Should return false if the code didn't
   * resolve so the input keeps focus for another attempt.
   */
  onResolve: (barcode: string) => Promise<boolean> | boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

/**
 * HID-friendly barcode field. USB / Bluetooth scanners commonly emulate
 * a keyboard — they type the digits and append Enter (or a CR/LF) at the
 * end. This component listens for `onSubmitEditing` and treats whatever
 * is in the box as the scanned code, then re-focuses for the next scan.
 *
 * Manual typing also works: clerks without a scanner can key the barcode
 * and press Done. There's a clear button so a half-typed entry can be
 * abandoned without firing onResolve.
 *
 * No native dependencies — works on iOS, Android and web.
 */
export default function BarcodeInput({
  onResolve,
  placeholder = 'Сканируйте или введите штрихкод',
  autoFocus = true,
}: Props) {
  const ref = useRef<any>(null);
  const [code, setCode] = useState('');
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (autoFocus) {
      // Slight delay so navigation animation completes before focus,
      // otherwise some platforms swallow the keyboard.
      const t = setTimeout(() => ref.current?.focus?.(), 200);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  const submit = async () => {
    const trimmed = code.trim();
    if (!trimmed || resolving) return;
    setResolving(true);
    try {
      const ok = await onResolve(trimmed);
      if (ok) setCode('');
      // Re-focus regardless of result so the next scan flows in.
      setTimeout(() => ref.current?.focus?.(), 0);
    } finally {
      setResolving(false);
    }
  };

  return (
    <View style={styles.row}>
      <TextInput
        ref={ref}
        mode="outlined"
        value={code}
        onChangeText={setCode}
        onSubmitEditing={submit}
        placeholder={placeholder}
        style={styles.input}
        returnKeyType="done"
        autoCorrect={false}
        autoCapitalize="none"
        // blurOnSubmit=false keeps keyboard up between scans
        blurOnSubmit={false}
        right={
          resolving ? (
            <TextInput.Icon icon={() => <ActivityIndicator size={20} />} />
          ) : code ? (
            <TextInput.Icon icon="close" onPress={() => setCode('')} />
          ) : (
            <TextInput.Icon icon="barcode-scan" />
          )
        }
      />
      <IconButton
        icon="send"
        mode="contained"
        onPress={submit}
        disabled={!code.trim() || resolving}
        style={styles.btn}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  input: { flex: 1 },
  btn: { marginTop: 6 },
});
