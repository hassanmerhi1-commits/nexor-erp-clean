// Realtime Store - Simplified for new async storage
// Now uses Electron WebSocket sync via preload API

import { useState, useEffect } from 'react';

export function useRealtimeStatus() {
  const [isConnected, setIsConnected] = useState(false);
  const [mode, setMode] = useState<'realtime' | 'local'>('local');

  useEffect(() => {
    const isElectron = !!window.electronAPI?.isElectron;
    if (isElectron) {
      setMode('realtime');
      setIsConnected(true);
    } else {
      setMode('local');
      setIsConnected(false);
    }
  }, []);

  return { isConnected, mode };
}
