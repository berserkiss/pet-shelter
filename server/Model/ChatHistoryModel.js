const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Модель для хранения истории диалогов с AI чатом
 * Позволяет сохранять историю между сессиями
 */
const ChatHistorySchema = new Schema({
  // ID пользователя
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Массив сообщений
  messages: [{
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    // Рекомендованные питомцы (если были)
    suggestedPets: [{
      type: Schema.Types.ObjectId,
      ref: 'Pet'
    }]
  }],

  // Метаданные
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  lastMessageAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Флаг активности (для архивации старых диалогов)
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

  // Режим чата: 'selection' (подбор питомца) или 'qa' (вопросы и ответы)
  mode: {
    type: String,
    enum: ['selection', 'qa'],
    default: 'selection',
    index: true
  },

  // Количество сообщений (для быстрого доступа)
  messageCount: {
    type: Number,
    default: 0
  }
});

// Индексы для быстрого поиска
ChatHistorySchema.index({ userId: 1, createdAt: -1 });
ChatHistorySchema.index({ userId: 1, isActive: 1 });
ChatHistorySchema.index({ userId: 1, mode: 1, isActive: 1 });
ChatHistorySchema.index({ lastMessageAt: -1 });

// Middleware для обновления lastMessageAt и messageCount
ChatHistorySchema.pre('save', function(next) {
  if (this.messages && this.messages.length > 0) {
    const lastMessage = this.messages[this.messages.length - 1];
    this.lastMessageAt = lastMessage.timestamp || new Date();
    this.messageCount = this.messages.length;
  }
  next();
});

// Метод для добавления сообщения
ChatHistorySchema.methods.addMessage = function(role, content, suggestedPets = []) {
  // Проверяем, что content существует и не пустой
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    console.warn(`⚠️ Попытка добавить сообщение без content. Role: ${role}`);
    content = role === 'assistant' ? 'Извините, не удалось обработать запрос.' : '[Пустое сообщение]';
  }
  
  this.messages.push({
    role,
    content: content.trim(),
    timestamp: new Date(),
    suggestedPets
  });
  
  // Обновляем счетчик сообщений и дату последнего сообщения
  this.messageCount = this.messages.length;
  this.lastMessageAt = new Date();
  
  return this.save();
};

// Метод для получения последних N сообщений
ChatHistorySchema.methods.getRecentMessages = function(limit = 20) {
  return this.messages.slice(-limit);
};

// Статический метод для получения или создания истории
ChatHistorySchema.statics.getOrCreate = async function(userId, mode = 'selection') {
  let history = await this.findOne({ userId, mode, isActive: true });
  
  if (!history) {
    history = await this.create({
      userId,
      mode,
      messages: [],
      isActive: true
    });
  }
  
  return history;
};

// Статический метод для архивации старых историй
ChatHistorySchema.statics.archiveOldHistories = async function(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const result = await this.updateMany(
    { 
      lastMessageAt: { $lt: cutoffDate },
      isActive: true 
    },
    { 
      $set: { isActive: false } 
    }
  );
  
  return result.modifiedCount;
};

module.exports = mongoose.model('ChatHistory', ChatHistorySchema);

