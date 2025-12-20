const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const favoriteSchema = new Schema({
    user_id: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    pet_id: {
        type: Schema.Types.ObjectId,
        ref: 'Pet',
        required: true
    }
}, { timestamps: true });

// Уникальный индекс для предотвращения дубликатов
favoriteSchema.index({ user_id: 1, pet_id: 1 }, { unique: true });

// Индекс для быстрого поиска по пользователю
favoriteSchema.index({ user_id: 1, createdAt: -1 });

module.exports = mongoose.model('Favorite', favoriteSchema);
