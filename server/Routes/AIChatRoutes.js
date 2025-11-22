const express = require('express');
const router = express.Router();
const { 
    getWelcome, 
    sendMessage, 
    getHistory, 
    clearHistory,
    getBreedInformation,
    clearAICache
} = require('../Controller/AIChatController');
const requireAuth = require('../Middleware/requireAuth');

// Все роуты требуют авторизации
router.use(requireAuth);

/**
 * GET /ai-chat/welcome
 * Получить приветственное сообщение и начать новый диалог
 */
router.get('/welcome', getWelcome);

/**
 * POST /ai-chat/message
 * Отправить сообщение в чат
 * Body: { message: string }
 */
router.post('/message', sendMessage);

/**
 * GET /ai-chat/history
 * Получить историю текущего диалога
 */
router.get('/history', getHistory);

/**
 * DELETE /ai-chat/history
 * Очистить историю диалога
 */
router.delete('/history', clearHistory);

/**
 * GET /ai-chat/breed-info
 * Получить информацию о породе
 * Query: breed=string, species=string
 */
router.get('/breed-info', getBreedInformation);

/**
 * POST /ai-chat/clear-cache
 * Очистить кэш AI-чата для принудительного обновления данных из БД
 */
router.post('/clear-cache', clearAICache);

module.exports = router;

