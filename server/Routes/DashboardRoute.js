const express = require('express');
const router = express.Router();
const {
    userRegistration, 
    petTypes, 
    petsByShelter, 
    petStatusStats, 
    adoptionTimeStats,
    formStatusStats,
    donationStats
} = require('../Controller/Dashboard');

router.get('/user-registrations', userRegistration);
router.get('/pet-types', petTypes);
router.get('/pets-by-shelter', petsByShelter);
router.get('/pet-status-stats', petStatusStats);
router.get('/adoption-time-stats', adoptionTimeStats);
router.get('/form-status-stats', formStatusStats);
router.get('/donation-stats', donationStats);

module.exports = router