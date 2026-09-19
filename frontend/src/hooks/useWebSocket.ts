import { useEffect, useRef, useState, useCallback } from 'react';
import { authFetch } from '@/lib/auth';

interface WsMessage {
  type: string;
  [key: string]: unknown;
}

export function useWebSocket(url: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WsMessage | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const reconnectAttempts = useRef(0);
  const unmountedRef = useRef(false);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;

    // Step 1: Get a short-lived ticket (30s, single-use)
    authFetch('/api/auth/ws-ticket')
      .then(r => r.ok ? r.json() : null)
      .then(async (ticketData) => {
        if (unmountedRef.current || !ticketData?.ticket) return;

        try {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const devPorts = ['5173', '5174', '3000'];
          const currentPort = window.location.port;
          const wsPort = devPorts.includes(currentPort) ? '8000' : currentPort;
          const wsHost = wsPort ? `${window.location.hostname}:${wsPort}` : window.location.hostname;
          const wsUrl = url.startsWith('ws')
            ? `${url}?ticket=${ticketData.ticket}`
            : `${protocol}//${wsHost}${url}?ticket=${ticketData.ticket}`;

          const ws = new WebSocket(wsUrl);
          wsRef.current = ws;

          ws.onopen = () => {
            if (unmountedRef.current) { ws.close(); return; }
            setConnected(true);
            reconnectAttempts.current = 0;

            const pingInterval = setInterval(() => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send('ping');
              }
            }, 25000);

            ws.addEventListener('close', () => clearInterval(pingInterval));
          };

          ws.onmessage = (event) => {
            if (unmountedRef.current) return;
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'pong') return;
              setLastMessage(data);
            } catch {}
          };

          ws.onclose = (event) => {
            if (unmountedRef.current) return;
            setConnected(false);
            if (event.code === 4001 || event.code === 4002) {
              console.error('[WS] Auth failed:', event.reason);
              return;
            }
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
            reconnectAttempts.current++;
            reconnectTimer.current = setTimeout(connect, delay);
          };

          ws.onerror = () => {
            ws.close();
          };
        } catch {
          if (unmountedRef.current) return;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;
          reconnectTimer.current = setTimeout(connect, delay);
        }
      })
      .catch(() => {
        if (unmountedRef.current) return;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current++;
        reconnectTimer.current = setTimeout(connect, delay);
      });
  }, [url]);

  useEffect(() => {
    unmountedRef.current = false;
    connect();
    return () => {
      unmountedRef.current = true;
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  return { connected, lastMessage, send };
}
