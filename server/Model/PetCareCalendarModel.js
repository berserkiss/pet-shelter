const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Схема события в календаре ухода за питомцем
 */
const careEventSchema = new Schema({
  type: {
    type: String,
    enum: [
      'vaccination',      // Прививка
      'vet_checkup',      // Осмотр у ветеринара
      'grooming',         // Груминг
      'deworming',        // Дегельминтизация
      'flea_treatment',   // Обработка от блох
      'nail_trimming',    // Стрижка когтей
      'teeth_cleaning',   // Чистка зубов
      'feeding_schedule', // График кормления
      'exercise',         // Физическая активность
      'medication',       // Прием лекарств
      'custom'            // Пользовательское событие
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  date: {
    type: Date,
    required: true
  },
  completed: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date
  },
  notes: {
    type: String,
    default: ''
  },
  // Повторяющееся событие
  recurring: {
    enabled: {
      type: Boolean,
      default: false
    },
    interval: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly'],
      default: 'monthly'
    },
    endDate: {
      type: Date
    }
  },
  // Напоминания
  reminders: [{
    type: {
      type: String,
      enum: ['email', 'push', 'sms'],
      default: 'email'
    },
    timeBeforeEvent: {
      type: Number, // в минутах
      default: 1440 // 1 день
    },
    sent: {
      type: Boolean,
      default: false
    }
  }],
  // Приоритет
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  // Стоимость (если применимо)
  cost: {
    amount: Number,
    currency: {
      type: String,
      default: 'BYN'
    }
  },
  // Ветеринарная клиника/грумер (если применимо)
  location: {
    name: String,
    address: String,
    phone: String
  }
}, { _id: true, timestamps: true });

/**
 * Основная схема календаря ухода за питомцем
 */
const petCareCalendarSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  petId: {
    type: Schema.Types.ObjectId,
    ref: 'Pet',
    required: true
  },
  // Информация о питомце (кэшируем для быстрого доступа)
  petInfo: {
    name: String,
    species: String,
    breed: String,
    birthDate: Date
  },
  // События календаря
  events: [careEventSchema],
  // Настройки календаря
  settings: {
    autoGenerateEvents: {
      type: Boolean,
      default: true // Автоматически создавать события на основе вида/породы
    },
    reminderPreferences: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    },
    timezone: {
      type: String,
      default: 'Europe/Minsk'
    }
  },
  // Статистика
  stats: {
    totalEvents: { type: Number, default: 0 },
    completedEvents: { type: Number, default: 0 },
    upcomingEvents: { type: Number, default: 0 },
    overdueEvents: { type: Number, default: 0 }
  }
}, { timestamps: true });

// Индексы для быстрого поиска
petCareCalendarSchema.index({ userId: 1, petId: 1 });
petCareCalendarSchema.index({ 'events.date': 1 });
petCareCalendarSchema.index({ 'events.completed': 1 });

// Виртуальное поле для получения предстоящих событий
petCareCalendarSchema.virtual('upcomingEvents').get(function() {
  const now = new Date();
  return this.events.filter(event => 
    !event.completed && event.date > now
  ).sort((a, b) => a.date - b.date);
});

// Виртуальное поле для получения просроченных событий
petCareCalendarSchema.virtual('overdueEvents').get(function() {
  const now = new Date();
  return this.events.filter(event => 
    !event.completed && event.date < now
  ).sort((a, b) => a.date - b.date);
});

// Метод для обновления статистики
petCareCalendarSchema.methods.updateStats = function() {
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Обнуляем время для корректного сравнения дат
  
  this.stats.totalEvents = this.events.length;
  this.stats.completedEvents = this.events.filter(e => e.completed).length;
  
  // Правильное сравнение дат с учетом того, что date может быть строкой или Date объектом
  this.stats.upcomingEvents = this.events.filter(e => {
    if (e.completed) return false;
    const eventDate = new Date(e.date);
    eventDate.setHours(0, 0, 0, 0);
    return eventDate > now;
  }).length;
  
  this.stats.overdueEvents = this.events.filter(e => {
    if (e.completed) return false;
    const eventDate = new Date(e.date);
    eventDate.setHours(0, 0, 0, 0);
    return eventDate < now;
  }).length;
};

// Метод для создания повторяющихся событий
petCareCalendarSchema.methods.generateRecurringEvents = function(eventId, numberOfOccurrences = 12) {
  const event = this.events.id(eventId);
  if (!event || !event.recurring.enabled) return;

  const interval = event.recurring.interval;
  const baseDate = new Date(event.date);
  const newEvents = [];

  for (let i = 1; i <= numberOfOccurrences; i++) {
    const newDate = new Date(baseDate);
    
    switch (interval) {
      case 'daily':
        newDate.setDate(baseDate.getDate() + i);
        break;
      case 'weekly':
        newDate.setDate(baseDate.getDate() + (i * 7));
        break;
      case 'monthly':
        newDate.setMonth(baseDate.getMonth() + i);
        break;
      case 'yearly':
        newDate.setFullYear(baseDate.getFullYear() + i);
        break;
    }

    // Проверяем, не превышает ли дата endDate
    if (event.recurring.endDate && newDate > event.recurring.endDate) {
      break;
    }

    newEvents.push({
      ...event.toObject(),
      _id: new mongoose.Types.ObjectId(),
      date: newDate,
      completed: false,
      completedAt: undefined,
      reminders: event.reminders.map(r => ({ ...r, sent: false }))
    });
  }

  this.events.push(...newEvents);
  this.updateStats();
};

// Middleware для обновления статистики перед сохранением
petCareCalendarSchema.pre('save', function(next) {
  this.updateStats();
  next();
});

module.exports = mongoose.model('PetCareCalendar', petCareCalendarSchema);

