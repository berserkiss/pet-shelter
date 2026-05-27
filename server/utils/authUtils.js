/** Извлечение JWT из заголовка Authorization (Bearer). */
function parseBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') {
    return { ok: false, token: null, error: 'Authorization token required' };
  }
  if (!authHeader.startsWith('Bearer ')) {
    return { ok: false, token: null, error: 'Authorization token required' };
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return { ok: false, token: null, error: 'Authorization token required' };
  }
  return { ok: true, token, error: null };
}

module.exports = { parseBearerToken };
