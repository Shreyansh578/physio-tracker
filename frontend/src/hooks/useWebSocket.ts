import { useState, useRef, useEffect, useCallback } from 'react';

export interface UseWebSocketReturn {
  send: (data: string) => void;
  lastMessage: any | null;
  isConnected: boolean;
  connect: (url: string) => void;
  disconnect: () => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastMessage, setLastMessage] = useState<any | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urlRef = useRef<string | null>(null);
  const explicitDisconnectRef = useRef<boolean>(false);

  const clearReconnectTimeout = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  const connect = useCallback((url: string) => {
    urlRef.current = url;
    explicitDisconnectRef.current = false;
    clearReconnectTimeout();

    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      const socket = new WebSocket(url);
      wsRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          setLastMessage(parsed);
        } catch {
          setLastMessage(event.data);
        }
      };

      socket.onerror = () => {
        // Will trigger onclose next
      };

      socket.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;

        // Auto-reconnect up to 3 times with exponential backoff if not closed explicitly
        if (!explicitDisconnectRef.current && urlRef.current && reconnectAttemptsRef.current < 3) {
          const delay = 1000 * Math.pow(2, reconnectAttemptsRef.current);
          reconnectAttemptsRef.current += 1;
          reconnectTimeoutRef.current = setTimeout(() => {
            if (!explicitDisconnectRef.current && urlRef.current) {
              connect(urlRef.current);
            }
          }, delay);
        }
      };
    } catch {
      setIsConnected(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    explicitDisconnectRef.current = true;
    clearReconnectTimeout();
    reconnectAttemptsRef.current = 0;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const send = useCallback((data: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  useEffect(() => {
    return () => {
      explicitDisconnectRef.current = true;
      clearReconnectTimeout();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return {
    send,
    lastMessage,
    isConnected,
    connect,
    disconnect,
  };
}
