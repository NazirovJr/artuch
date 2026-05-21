import { useCallback, useState } from 'react';

/**
 * Wraps a sensitive operation that requires a manager PIN. Usage:
 *
 *   const { request, dialogProps } = useManagerApproval();
 *   const onPressRefund = () =>
 *     request('refund', async (pin) => {
 *       await createRefund({ ...payload, managerPin: pin });
 *     });
 *
 *   <ManagerPinDialog {...dialogProps} />
 *
 * The dialog only opens when `request` is called. The provided action receives
 * the PIN; if it throws, the error is shown inline and the dialog stays open.
 */
export function useManagerApproval() {
  const [visible, setVisible] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<((pin: string) => Promise<any>) | null>(
    null,
  );

  const request = useCallback(
    (newReason: string, newAction: (pin: string) => Promise<any>) => {
      setReason(newReason);
      setError(null);
      setAction(() => newAction);
      setVisible(true);
    },
    [],
  );

  const onConfirm = useCallback(
    async (pin: string) => {
      if (!action) return;
      setLoading(true);
      setError(null);
      try {
        await action(pin);
        setVisible(false);
      } catch (e: any) {
        setError(e?.message || 'Ошибка подтверждения');
      } finally {
        setLoading(false);
      }
    },
    [action],
  );

  const onCancel = useCallback(() => {
    if (loading) return;
    setVisible(false);
  }, [loading]);

  return {
    request,
    dialogProps: { visible, reason, onCancel, onConfirm, loading, error },
  };
}
