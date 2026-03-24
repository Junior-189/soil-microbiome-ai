import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

export function useSocket(farmId) {
  const [latestReading, setLatestReading] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!farmId) return;

    const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      query: { farmId },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('sensor_reading', (reading) => setLatestReading(reading));

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [farmId]);

  return { latestReading, isConnected };
}
