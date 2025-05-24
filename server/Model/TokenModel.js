const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const tokenSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    token: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['access', 'refresh'],
        required: true
    },
    isRevoked: {
        type: Boolean,
        default: false
    },
    expiresAt: {
        type: Date,
        required: true
    }
});

// Индекс для быстрого поиска по токену
tokenSchema.index({ token: 1 });

// Индекс для быстрого поиска по userId
tokenSchema.index({ userId: 1 });

// TTL индекс для автоматического удаления истекших токенов
tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

tokenSchema.index({ 
    isRevoked: 1,
    expiresAt: 1 
});

module.exports = mongoose.model('Token', tokenSchema); 