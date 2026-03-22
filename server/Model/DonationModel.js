const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const donationSchema = new Schema({
    shelter_id: {
        type: Schema.Types.ObjectId,
        ref: 'Shelter',
        required: true
    },
    user_id: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: false // Можно донатить анонимно
    },
    userName: {
        type: String,
        required: false // Имя донатера (если не анонимно)
    },
    email: {
        type: String,
        required: false // Email для подтверждения (если не анонимно)
    },
    amount: {
        type: Number,
        required: true,
        min: 1
    },
    currency: {
        type: String,
        default: 'BYN',
        enum: ['BYN', 'USD', 'EUR', 'RUB']
    },
    message: {
        type: String,
        maxlength: 500
    },
    isAnonymous: {
        type: Boolean,
        default: false
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'completed' // Для простоты считаем сразу completed
    },
    paymentMethod: {
        type: String,
        enum: ['card', 'paypal', 'bank_transfer', 'crypto'],
        default: 'card'
    },
    paymentIntentId: {
        type: String,
        required: false // ID платежа из Stripe
    }
}, { timestamps: true });

// Индекс для быстрого поиска по приюту
donationSchema.index({ shelter_id: 1, createdAt: -1 });

// Виртуальное поле для отображения имени донатера
donationSchema.virtual('displayName').get(function() {
    if (this.isAnonymous) {
        return 'Анонимный донатор';
    }
    return this.userName || 'Без имени';
});

// Метод для получения общей суммы пожертвований по приюту (за всё время)
donationSchema.statics.getTotalByShelter = async function(shelterId) {
    const result = await this.aggregate([
        { 
            $match: { 
                shelter_id: new mongoose.Types.ObjectId(shelterId),
                paymentStatus: 'completed'
            } 
        },
        { 
            $group: { 
                _id: null, 
                total: { $sum: '$amount' },
                count: { $sum: 1 }
            } 
        }
    ]);
    
    return result.length > 0 ? result[0] : { total: 0, count: 0 };
};

/**
 * Сумма и количество пожертвований за календарный месяц (локальное время сервера).
 * Нужно для прогресса к месячной цели — старые донаты не «тянутся» в новый месяц.
 */
donationSchema.statics.getTotalByShelterInCalendarMonth = async function(shelterId, referenceDate = new Date()) {
    const y = referenceDate.getFullYear();
    const m = referenceDate.getMonth();
    const start = new Date(y, m, 1, 0, 0, 0, 0);
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999);

    const result = await this.aggregate([
        {
            $match: {
                shelter_id: new mongoose.Types.ObjectId(shelterId),
                paymentStatus: 'completed',
                createdAt: { $gte: start, $lte: end }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        }
    ]);

    return result.length > 0 ? result[0] : { total: 0, count: 0 };
};

// Метод для получения последних пожертвований по приюту
donationSchema.statics.getRecentByShelter = async function(shelterId, limit = 10) {
    return this.find({ 
        shelter_id: shelterId,
        paymentStatus: 'completed'
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('-email'); // Не раскрываем email публично
};

module.exports = mongoose.model('Donation', donationSchema);
