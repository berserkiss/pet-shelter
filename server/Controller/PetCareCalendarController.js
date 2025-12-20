/**
 * Контроллер для управления календарем ухода за питомцами
 */

const petCareService = require('../services/petCareService');

/**
 * Создать календарь для питомца
 * POST /api/pet-care/calendar/:petId
 */
const createCalendar = async (req, res) => {
  try {
    const userId = req.user._id;
    const { petId } = req.params;

    const calendar = await petCareService.createCareCalendar(userId, petId);
    
    res.status(201).json({
      message: 'Календарь успешно создан',
      calendar
    });
  } catch (error) {
    console.error('Ошибка создания календаря:', error);
    res.status(500).json({ 
      error: 'Не удалось создать календарь',
      details: error.message 
    });
  }
};

/**
 * Получить календарь для конкретного питомца
 * GET /api/pet-care/calendar/:petId
 */
const getCalendar = async (req, res) => {
  try {
    const userId = req.user._id;
    const { petId } = req.params;

    const calendar = await petCareService.getCareCalendar(userId, petId);
    
    if (!calendar) {
      return res.status(404).json({ error: 'Календарь не найден' });
    }

    res.json(calendar);
  } catch (error) {
    console.error('Ошибка получения календаря:', error);
    res.status(500).json({ 
      error: 'Не удалось получить календарь',
      details: error.message 
    });
  }
};

/**
 * Получить все календари пользователя
 * GET /api/pet-care/calendars
 */
const getAllCalendars = async (req, res) => {
  try {
    const userId = req.user._id;

    const calendars = await petCareService.getUserCalendars(userId);
    
    res.json(calendars);
  } catch (error) {
    console.error('Ошибка получения календарей:', error);
    res.status(500).json({ 
      error: 'Не удалось получить календари',
      details: error.message 
    });
  }
};

/**
 * Получить предстоящие события
 * GET /api/pet-care/upcoming?days=30
 */
const getUpcomingEvents = async (req, res) => {
  try {
    const userId = req.user._id;
    const daysAhead = parseInt(req.query.days) || 30;

    const events = await petCareService.getUpcomingEvents(userId, daysAhead);
    
    res.json(events);
  } catch (error) {
    console.error('Ошибка получения предстоящих событий:', error);
    res.status(500).json({ 
      error: 'Не удалось получить события',
      details: error.message 
    });
  }
};

/**
 * Добавить событие в календарь
 * POST /api/pet-care/calendar/:petId/events
 */
const addEvent = async (req, res) => {
  try {
    const userId = req.user._id;
    const { petId } = req.params;
    const eventData = req.body;

    // Валидация
    if (!eventData.type || !eventData.title || !eventData.date) {
      return res.status(400).json({ 
        error: 'Обязательные поля: type, title, date' 
      });
    }

    const calendar = await petCareService.addEvent(userId, petId, eventData);
    
    res.status(201).json({
      message: 'Событие добавлено',
      calendar
    });
  } catch (error) {
    console.error('Ошибка добавления события:', error);
    res.status(500).json({ 
      error: 'Не удалось добавить событие',
      details: error.message 
    });
  }
};

/**
 * Обновить событие
 * PUT /api/pet-care/calendar/:petId/events/:eventId
 */
const updateEvent = async (req, res) => {
  try {
    const userId = req.user._id;
    const { petId, eventId } = req.params;
    const updates = req.body;

    const calendar = await petCareService.updateEvent(userId, petId, eventId, updates);
    
    res.json({
      message: 'Событие обновлено',
      calendar
    });
  } catch (error) {
    console.error('Ошибка обновления события:', error);
    res.status(500).json({ 
      error: 'Не удалось обновить событие',
      details: error.message 
    });
  }
};

/**
 * Отметить событие как выполненное
 * POST /api/pet-care/calendar/:petId/events/:eventId/complete
 */
const completeEvent = async (req, res) => {
  try {
    const userId = req.user._id;
    const { petId, eventId } = req.params;
    const { notes, eventDate } = req.body;

    const calendar = await petCareService.completeEvent(userId, petId, eventId, notes, eventDate);
    
    // Отправляем событие через Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`userId:${userId}`).emit('eventCompleted', {
        petId,
        eventId,
        completedAt: new Date()
      });
    }

    res.json({
      message: 'Событие отмечено как выполненное',
      calendar
    });
  } catch (error) {
    console.error('Ошибка завершения события:', error);
    res.status(500).json({ 
      error: 'Не удалось завершить событие',
      details: error.message 
    });
  }
};

/**
 * Удалить событие
 * DELETE /api/pet-care/calendar/:petId/events/:eventId
 */
const deleteEvent = async (req, res) => {
  try {
    const userId = req.user._id;
    const { petId, eventId } = req.params;

    const calendar = await petCareService.deleteEvent(userId, petId, eventId);
    
    res.json({
      message: 'Событие удалено',
      calendar
    });
  } catch (error) {
    console.error('Ошибка удаления события:', error);
    res.status(500).json({ 
      error: 'Не удалось удалить событие',
      details: error.message 
    });
  }
};

/**
 * AI-помощник для вопросов о календаре
 * POST /api/pet-care/calendar/:petId/ai-assistant
 */
const askAIAssistant = async (req, res) => {
  try {
    const userId = req.user._id;
    const { petId } = req.params;
    const { question } = req.body;

    if (!question || question.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Вопрос обязателен' 
      });
    }

    const calendar = await petCareService.getCareCalendar(userId, petId);
    if (!calendar) {
      return res.status(404).json({ error: 'Календарь не найден' });
    }

    const result = await petCareService.askAICareAssistant(userId, petId, question, calendar);
    
    res.json(result);
  } catch (error) {
    console.error('Ошибка AI-помощника:', error);
    res.status(500).json({ 
      error: 'Не удалось обработать вопрос',
      details: error.message 
    });
  }
};

/**
 * Получить AI-аналитику по календарю
 * GET /api/pet-care/calendar/:petId/analytics
 */
const getAIAnalytics = async (req, res) => {
  try {
    const userId = req.user._id;
    const { petId } = req.params;

    const calendar = await petCareService.getCareCalendar(userId, petId);
    if (!calendar) {
      return res.status(404).json({ error: 'Календарь не найден' });
    }

    const analytics = await petCareService.getAICalendarAnalytics(userId, petId, calendar);
    
    res.json(analytics);
  } catch (error) {
    console.error('Ошибка получения аналитики:', error);
    res.status(500).json({ 
      error: 'Не удалось получить аналитику',
      details: error.message 
    });
  }
};

/**
 * Перегенерировать календарь с помощью AI
 * POST /api/pet-care/calendar/:petId/regenerate
 */
const regenerateCalendar = async (req, res) => {
  try {
    const userId = req.user._id;
    const { petId } = req.params;

    const calendar = await petCareService.regenerateAICalendarEvents(userId, petId);
    
    res.json({
      message: 'Календарь успешно перегенерирован с помощью AI',
      calendar
    });
  } catch (error) {
    console.error('Ошибка перегенерации календаря:', error);
    res.status(500).json({ 
      error: 'Не удалось перегенерировать календарь',
      details: error.message 
    });
  }
};

/**
 * Экспортировать календарь в формат iCal
 * GET /api/pet-care/calendar/:petId/export
 */
const exportCalendar = async (req, res) => {
  try {
    const userId = req.user._id;
    const { petId } = req.params;

    const calendar = await petCareService.getCareCalendar(userId, petId);
    
    if (!calendar) {
      return res.status(404).json({ error: 'Календарь не найден' });
    }

    const icalContent = petCareService.exportCalendarToICal(calendar);
    
    if (!icalContent) {
      return res.status(400).json({ 
        error: 'Нет событий для экспорта' 
      });
    }

    const petName = calendar.petInfo?.name || 'Питомец';
    const fileName = `Календарь_${petName}_${new Date().toISOString().split('T')[0]}.ics`;
    
    // Устанавливаем заголовки для скачивания файла
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Cache-Control', 'no-cache');
    
    res.send(icalContent);
  } catch (error) {
    console.error('Ошибка экспорта календаря:', error);
    res.status(500).json({ 
      error: 'Не удалось экспортировать календарь',
      details: error.message 
    });
  }
};

module.exports = {
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
  regenerateCalendar,
  exportCalendar
};

