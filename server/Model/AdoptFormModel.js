const mongoose = require('mongoose')
const Schema = mongoose.Schema

const adoptFormSchema = new Schema({
    user_id: {
        type: Schema.Types.ObjectId,
        ref: 'User',
    },
    email: {
        type: String,
        required: true
    },
    phoneNo: {
        type: String,
        required: true
    },
    livingSituation: {
        type: String,
        required: true
    },
    previousExperience: {
        type: String,
        required: true
    },
    familyComposition: {
        type: String,
        required: true
    },
    petId: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'InReview', 'Approved', 'Rejected'],
        default: 'Pending'
    }
}, { timestamps: true})

module.exports = mongoose.model('AdoptForm', adoptFormSchema)