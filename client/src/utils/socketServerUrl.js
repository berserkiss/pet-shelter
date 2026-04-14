/**
 * URL для socket.io-client.
 * В production за nginx всё идёт с одного origin → window.location.origin.
 * В dev (CRA) прокси WebSocket для /socket.io часто даёт "Invalid frame header",
 * поэтому подключаемся напрямую к API (CORS на сервере уже разрешает localhost:3000).
 */
export function getSocketServerUrl() {
  if (process.env.NODE_ENV === 'development') {
    return process.env.REACT_APP_SOCKET_URL || 'http://localhost:4000';
  }
  return typeof window !== 'undefined' ? window.location.origin : '';
}
