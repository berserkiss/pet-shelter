const express = require('express');
const router = express.Router();
const requireAuth = require('../Middleware/requireAuth');
const {
  createCalendar,
  getCalendar,
  getAllCalendars,
  getUpcomingEvents,
  addEvent,
  updateEvent,
  completeEvent,
  deleteEvent,
  askAIAssistant,
  getAIAnalytics,
  regenerateCalendar
} = require('../Controller/PetCareCalendarController');

// Все маршруты требуют авторизации
router.use(requireAuth);

// Получить все календари пользователя
router.get('/calendars', getAllCalendars);

// Получить предстоящие события
router.get('/upcoming', getUpcomingEvents);

// Создать календарь для питомца
router.post('/calendar/:petId', createCalendar);

// Получить календарь для конкретного питомца
router.get('/calendar/:petId', getCalendar);

// Добавить событие в календарь
router.post('/calendar/:petId/events', addEvent);

// Обновить событие
router.put('/calendar/:petId/events/:eventId', updateEvent);

// Отметить событие как выполненное
router.post('/calendar/:petId/events/:eventId/complete', completeEvent);

// Удалить событие
router.delete('/calendar/:petId/events/:eventId', deleteEvent);

// AI-помощник для вопросов о календаре
router.post('/calendar/:petId/ai-assistant', askAIAssistant);

// Получить AI-аналитику по календарю
router.get('/calendar/:petId/analytics', getAIAnalytics);

// Перегенерировать календарь с помощью AI
router.post('/calendar/:petId/regenerate', regenerateCalendar);

module.exports = router;

