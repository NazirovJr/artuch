import React, { useEffect, useState } from 'react';
import { Dialog, Portal, Button, TextInput, Text } from 'react-native-paper';
import { StyleSheet } from 'react-native';

interface Props {
  visible: boolean;
  reason: string;
  onCancel: () => void;
  onConfirm: (pin: string) => Promise<void> | void;
  loading?: boolean;
  error?: string | null;
}

/**
 * Generic confirmation dialog: prompts for a manager/admin PIN before
 * executing a sensitive operation (refund, discount, close folio, etc).
 */
export default function ManagerPinDialog({
  visible,
  reason,
  onCancel,
  onConfirm,
  loading,
  error,
}: Props) {
  const [pin, setPin] = useState('');

  useEffect(() => {
    if (!visible) setPin('');
  }, [visible]);

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onCancel} dismissable={!loading}>
        <Dialog.Title>Подтверждение менеджера</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium" style={styles.reason}>
            Операция «{reason}» требует PIN менеджера или администратора.
          </Text>
          <TextInput
            label="PIN"
            mode="outlined"
            keyboardType="number-pad"
            secureTextEntry
            value={pin}
            onChangeText={setPin}
            autoFocus
            disabled={loading}
            maxLength={8}
          />
          {error ? (
            <Text variant="bodySmall" style={styles.error}>
              {error}
            </Text>
          ) : null}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onCancel} disabled={loading}>
            Отмена
          </Button>
          <Button
            mode="contained"
            onPress={() => onConfirm(pin)}
            loading={loading}
            disabled={loading || pin.length < 4}
          >
            Подтвердить
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  reason: { marginBottom: 12 },
  error: { color: '#D32F2F', marginTop: 8 },
});
