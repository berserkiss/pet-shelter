const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const shelterSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    city: { type: String, required: true },
    street: { type: String, required: true },
    house: { type: String, required: true },

    phone: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    workingHours: {
        type: String,
        required: true
    },
    max_capacity: {
        type: Number,
        required: true
    },
    current_capacity: {
        type: Number,
        default: 0
    },
    donationGoal: {
        type: Number,
        default: 0 // Цель сбора средств (если 0 - нет цели)
    },
    donationDescription: {
        type: String,
        default: '' // Описание для чего собираются средства
    }
}, { timestamps: true });

shelterSchema.methods.checkCapacity = async function() {
    return this.current_capacity < this.max_capacity;
};

shelterSchema.methods.incrementCapacity = async function() {
    if (this.current_capacity >= this.max_capacity) {
        throw new Error('Shelter is at full capacity');
    }
    this.current_capacity += 1;
    return this.save();
};

shelterSchema.methods.decrementCapacity = async function() {
    this.current_capacity = Math.max(0, this.current_capacity - 1);
    return this.save();
};

module.exports = mongoose.model('Shelter', shelterSchema);