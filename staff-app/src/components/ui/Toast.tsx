/**
 * Toast — Sonner-style multi-toast stack with auto-dismiss.
 *
 * API keeps backward compatibility: `useToast().show(message, type)` still
 * works for older screens; new code can use `toast.success(...)` /
 * `toast.error(...)` / etc.
 *
 * Why custom (not Paper's Snackbar): Snackbar is a single-instance bottom
 * sheet — you can't show two notifications at once. Sonner-pattern stacks
 * multiple cards top-of-screen, perfect for kitchen floor where several
 * orders may land in quick succession.
 *
 * Stack behaviour:
 *   - max 3 visible; new toasts push older off
 *   - default 4s auto-dismiss; tap to dismiss immediately
 *   - haptic feedback on success/error (when useHaptics resolves)
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { View, StyleSheet, Pressable, type ViewStyle } from 'react-native';
import { Text, Icon } from 'react-native-paper';
import Animated, { FadeInUp, FadeOutUp, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../hooks/useAppTheme';
import { semantic } from '../../theme/colors';
import { spacing, borderRadius, shadows } from '../../theme/spacing';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastInput {
  title: string;
  description?: string;
  type?: ToastType;
  duration?: number;
  /** Optional CTA button shown on the right of the toast. */
  actionLabel?: string;
  /** Invoked when the CTA is pressed. Toast auto-dismisses after. */
  onAction?: () => void;
}

interface ToastItem extends Required<Pick<ToastInput, 'title' | 'type' | 'duration'>> {
  id: number;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastApi {
  /** Backward-compat: original 2-arg signature */
  show: (message: string, type?: ToastType) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  /** Full API */
  toast: (input: ToastInput) => void;
  dismiss: (id: number) => void;
}

const noop = () => {};
const ToastContext = createContext<ToastApi>({
  show: noop,
  success: noop,
  error: noop,
  info: noop,
  warning: noop,
  toast: noop,
  dismiss: noop,
});

const TYPE_ICON: Record<ToastType, string> = {
  success: 'check-circle',
  error: 'alert-circle',
  warning: 'alert',
  info: 'information',
};

const TYPE_COLOR: Record<ToastType, string> = {
  success: semantic.success,
  error: semantic.error,
  warning: semantic.warning,
  info: semantic.info,
};

const MAX_STACK = 3;
const DEFAULT_DURATION = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      // CTA-toasts linger a bit longer by default — the user has to notice
      // the button and decide whether to tap it.
      const hasAction = Boolean(input.actionLabel && input.onAction);
      const item: ToastItem = {
        id,
        title: input.title,
        description: input.description,
        type: input.type ?? 'info',
        duration: input.duration ?? (hasAction ? 7000 : DEFAULT_DURATION),
        actionLabel: input.actionLabel,
        onAction: input.onAction,
      };
      setItems((prev) => [...prev.slice(-(MAX_STACK - 1)), item]);
    },
    [],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show: (message, type = 'info') => push({ title: message, type }),
      success: (title, description) => push({ title, description, type: 'success' }),
      error: (title, description) => push({ title, description, type: 'error' }),
      info: (title, description) => push({ title, description, type: 'info' }),
      warning: (title, description) => push({ title, description, type: 'warning' }),
      toast: push,
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: number) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.viewport, { paddingTop: insets.top + spacing.sm }]}>
      {items.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </View>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const theme = useAppTheme();
  const accent = TYPE_COLOR[item.type];

  useEffect(() => {
    const handle = setTimeout(() => onDismiss(item.id), item.duration);
    return () => clearTimeout(handle);
  }, [item.id, item.duration, onDismiss]);

  const cardStyle: ViewStyle = {
    backgroundColor: theme.colors.surface,
    borderRadius: borderRadius.md,
    borderLeftColor: accent,
    borderLeftWidth: 4,
    ...shadows.md,
  };

  const handleAction = () => {
    try {
      item.onAction?.();
    } finally {
      onDismiss(item.id);
    }
  };

  return (
    <Animated.View
      entering={FadeInUp.springify().damping(20)}
      exiting={FadeOutUp.duration(200)}
      layout={LinearTransition.springify()}
      style={styles.cardWrapper}
    >
      <Pressable onPress={() => onDismiss(item.id)} style={[styles.card, cardStyle]}>
        <Icon source={TYPE_ICON[item.type]} size={22} color={accent} />
        <View style={styles.body}>
          <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>
            {item.title}
          </Text>
          {item.description ? (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
              {item.description}
            </Text>
          ) : null}
        </View>
        {item.actionLabel && item.onAction ? (
          <Pressable
            onPress={handleAction}
            // Stop the outer Pressable from swallowing the tap as dismiss.
            // `hitSlop` widens the target for grubby kitchen fingers.
            hitSlop={10}
            style={({ pressed }) => [
              styles.actionBtn,
              { backgroundColor: pressed ? theme.colors.primaryContainer : 'transparent' },
            ]}
          >
            <Text
              variant="labelLarge"
              style={{ color: accent, fontWeight: '700' }}
            >
              {item.actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  viewport: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    zIndex: 9999,
    elevation: 9999,
  },
  cardWrapper: {
    marginBottom: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    gap: spacing.sm,
  },
  body: {
    flex: 1,
  },
  actionBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    alignSelf: 'center',
  },
});
