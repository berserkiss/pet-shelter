const { resolveClientBaseUrl } = require('./domainRules');

/**
 * Базовый URL фронтенда для ссылок в письмах, редиректах и т.п.
 * Если в CLIENT_URLS есть и http, и https — предпочитаем https.
 */
function getClientBaseUrl() {
    const raw = process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:3000';
    return resolveClientBaseUrl(raw);
}

module.exports = { getClientBaseUrl };
