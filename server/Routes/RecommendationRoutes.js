const express = require('express');
const router = express.Router();
const requireAuth = require('../Middleware/requireAuth');
const { getPetRecommendations, getCompareRecommendationHandler } = require('../Controller/RecommendationController');

router.get('/pets', getPetRecommendations);
router.post('/compare', requireAuth, getCompareRecommendationHandler);

module.exports = router;

