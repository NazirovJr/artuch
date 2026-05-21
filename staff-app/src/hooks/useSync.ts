import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { fullSync } from '../db/syncManager';

export function useSync(intervalMs = 30000) {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // Sync on mount
    fullSync().catch(() => {});

    // Sync periodically
    const timer = setInterval(() => { fullSync().catch(() => {}); }, intervalMs);

    // Sync when app comes to foreground
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        fullSync().catch(() => {});
      }
      appState.current = nextState;
    });

    return () => { clearInterval(timer); sub.remove(); };
  }, [intervalMs]);
}
