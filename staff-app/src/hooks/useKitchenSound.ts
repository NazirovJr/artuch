/**
 * useKitchenSound — plays a short bell when a new order arrives in the kitchen.
 *
 * Registry pattern: we can't `require('../../assets/sounds/new-order.mp3')`
 * at module scope because Metro resolves requires statically, so a missing
 * asset would crash the bundle. Instead the app registers the asset at boot
 * via `registerKitchenSound(require(...))`. If never registered, the hook
 * silently no-ops — kitchen UI keeps working without the chime file.
 *
 * To add sound:
 *   1. Drop a ≤500ms mp3 at `assets/sounds/new-order.mp3`
 *   2. In `App.tsx`:
 *      import { registerKitchenSound } from './src/hooks/useKitchenSound';
 *      registerKitchenSound(require('./assets/sounds/new-order.mp3'));
 */
import { useCallback, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';

// Registered lazily; stays null unless App.tsx registers it.
let REGISTERED_SOUND: number | null = null;

/** Register the new-order chime asset. Call once, before any kitchen screen mounts. */
export function registerKitchenSound(assetModule: number) {
  REGISTERED_SOUND = assetModule;
}

export function useKitchenSound() {
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    if (!REGISTERED_SOUND) return;
    let cancelled = false;

    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
        const { sound } = await Audio.Sound.createAsync(REGISTERED_SOUND!, { shouldPlay: false });
        if (cancelled) {
          await sound.unloadAsync();
          return;
        }
        soundRef.current = sound;
      } catch {
        /* asset missing or audio session denied — fall back to silent */
      }
    })();

    return () => {
      cancelled = true;
      const s = soundRef.current;
      soundRef.current = null;
      s?.unloadAsync().catch(() => {});
    };
  }, []);

  /** Play the new-order chime. Safe to call from anywhere; throws no errors. */
  const playNewOrder = useCallback(async () => {
    const s = soundRef.current;
    if (!s) return;
    try {
      // Rewind first so rapid sequential orders all chime.
      await s.setPositionAsync(0);
      await s.playAsync();
    } catch {
      /* ignore — best-effort */
    }
  }, []);

  return { playNewOrder };
}
