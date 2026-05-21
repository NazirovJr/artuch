import { useEffect } from 'react';
import { getSocket } from './socketClient';

export function useSocketEvent<T = any>(
  event: string,
  handler: (data: T) => void,
) {
  useEffect(() => {
    let socket: ReturnType<typeof getSocket> extends Promise<infer S>
      ? S
      : never;
    let mounted = true;

    getSocket().then((s) => {
      if (!mounted) return;
      socket = s as any;
      socket.on(event, handler);
    });

    return () => {
      mounted = false;
      if (socket) {
        socket.off(event, handler);
      }
    };
  }, [event, handler]);
}
