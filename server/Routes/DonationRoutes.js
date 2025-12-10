const express = require('express');
const router = express.Router();
const {
    createDonation,
    getShelterDonationStats,
    getShelterRecentDonations,
    getUserDonations,
    getShelterDonationHistory,
    resetShelterDonationGoal
} = require('../Controller/DonationController');
const requireAuth = require('../Middleware/requireAuth');
const optionalAuth = require('../Middleware/OptionalAuth');

// Публичные роуты
router.get('/shelter/:shelterId/stats', getShelterDonationStats);
router.get('/shelter/:shelterId/recent', getShelterRecentDonations);
router.get('/shelter/:shelterId/history', getShelterDonationHistory);

// Создание пожертвования (можно анонимно, но если пользователь авторизован - используем его данные)
router.post('/create', optionalAuth, createDonation);

// Защищенные роуты
router.get('/user/my-donations', requireAuth, getUserDonations);

// Сброс цели сбора средств (только для админов)
router.put('/shelter/:shelterId/reset-goal', requireAuth, resetShelterDonationGoal);

module.exports = router;
