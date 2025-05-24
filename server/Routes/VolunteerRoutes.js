const express = require('express');
const router = express.Router();
const requireAuth = require('../Middleware/requireAuth');
const {
    submitVolunteerApplication,
    getAllVolunteerApplications,
    getShelterVolunteerApplications,
    updateVolunteerStatus,
    deleteVolunteerApplication,
    checkExistingVolunteerApplication
} = require('../Controller/VolunteerController');

// Обновляем маршрут для отправки заявки, чтобы он требовал аутентификации
router.post('/', requireAuth, submitVolunteerApplication);

// Маршрут для проверки существующей заявки
router.get('/check/:shelterId', requireAuth, checkExistingVolunteerApplication);

// Защищенные маршруты (только для администраторов)
router.get('/', requireAuth, getAllVolunteerApplications);
router.get('/shelter/:shelter_id', requireAuth, getShelterVolunteerApplications);
router.put('/:id', requireAuth, updateVolunteerStatus);
router.delete('/:id', requireAuth, deleteVolunteerApplication);

module.exports = router; 