const { createProxyMiddleware } = require('http-proxy-middleware');

/**
 * CRA dev-server proxy.
 *
 * The app calls the backend via same-origin paths like `/api/...` (to match nginx in Docker),
 * but Express listens on `http://localhost:4000` without the `/api` prefix for most routes.
 *
 * This rewrites:
 *   /api/foo -> http://localhost:4000/foo
 */
module.exports = function setupProxy(app) {
  // Только для Node (dev-server). Пустая строка / "undefined" из .env не должны ломать target.
  const raw = process.env.REACT_APP_PROXY_TARGET;
  const target =
    raw && String(raw).trim() && String(raw).trim() !== 'undefined'
      ? String(raw).trim()
      : 'http://localhost:4000';

  // Важно: НЕ включать ws:true на /api — иначе middleware перехватывает WebSocket-апгрейды
  // webpack-dev-server (путь /ws для HMR) и в логах сыпется "proxying ... /ws to undefined".
  app.use(
    '/api',
    createProxyMiddleware({
      target,
      changeOrigin: true,
      pathRewrite: (path) => path.replace(/^\/api/, '') || '/',
    })
  );

  app.use(
    '/socket.io',
    createProxyMiddleware({
      target,
      changeOrigin: true,
      ws: true,
    })
  );
};
