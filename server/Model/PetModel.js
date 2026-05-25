const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const petSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    birthDate: {
        type: Date,
        required: true
    },
    species: {
        type: String,
        required: true
    },
    breed: {
        type: String,
        required: true
    },

    description: {
        type: String,
        required: true
    },
    size: {
        type: String,
        enum: ['small', 'medium', 'large', 'giant'],
        default: 'medium'
    },
    energyLevel: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    careLevel: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    isKidFriendly: {
        type: Boolean,
        default: true
    },
    isPetFriendly: {
        type: Boolean,
        default: true
    },
    hypoallergenic: {
        type: Boolean,
        default: false
    },
    temperamentTraits: {
        type: [String],
        default: []
    },
    activityNeeds: {
        type: String,
        enum: ['low', 'moderate', 'high'],
        default: 'moderate'
    },
    medicalNotes: {
        type: String,
        default: ''
    },
    shelter_id: {
        type: Schema.Types.ObjectId,
        ref: 'Shelter',
        required: true
    },
    // Остальные существующие поля
    area: String,
    justification: String,
    email: String,
    phone: String,
    filename: String,
    status: {
        type: String,
        enum: ['Pending', 'InReview', 'Approved', 'Adopted', 'Rejected'],
        default: 'Pending'
    },
    // Информация об усыновлении
    adopter_email: String, // Email пользователя, усыновившего питомца
    // Add reference to User model for the adopter
    adopter_id: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    user_id: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

// Удаляем виртуальное свойство age, если оно есть
// Или оставляем его, но переписываем логику
petSchema.virtual('age').get(function() {
    if (!this.birthDate) return null;
    
    const today = new Date();
    const birthDate = this.birthDate;
    const ageInMs = today - birthDate;
    
    // Возвращаем возраст в годах (как число с плавающей точкой)
    return ageInMs / (1000 * 60 * 60 * 24 * 365.25);
});

// Обеспечить включение виртуальных свойств при преобразовании в JSON
petSchema.set('toJSON', { virtuals: true });
petSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Pet', petSchema);

console.log("PetModel loaded successfully");