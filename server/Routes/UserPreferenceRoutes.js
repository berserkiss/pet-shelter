const express = require('express');
const router = express.Router();
const { getUserPreferences, updateUserPreferences, clearUserPreferences } = require('../Controller/UserPreferenceController');

router.get('/', getUserPreferences);
router.put('/', updateUserPreferences);
router.delete('/', clearUserPreferences);

module.exports = router;

