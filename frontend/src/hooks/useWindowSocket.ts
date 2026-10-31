import { useEffect, useState } from 'react';
import { socket } from '../lib/socket.js';

export function useWindowSocket(windowId?: string, onQueueUpdate?: (data?: any) => void) {
  const [isConnected, setIsConnected] = useState<boolean>(socket.connected);

  useEffect(() => {
    if (!windowId) return;

    if (!socket.connected) {
      socket.connect();
    }

    const handleConnect = () => {
      setIsConnected(true);
      socket.emit('join:window', windowId);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleQueueUpdate = (data?: any) => {
      if (onQueueUpdate) {
        onQueueUpdate(data);
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('queue:update', handleQueueUpdate);

    if (socket.connected) {
      socket.emit('join:window', windowId);
    }

    return () => {
      socket.emit('leave:window', windowId);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('queue:update', handleQueueUpdate);
    };
  }, [windowId, onQueueUpdate]);

  return { isConnected };
}
