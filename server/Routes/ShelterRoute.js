const express = require('express');
const router = express.Router();
const { 
  getAllShelters, 
  getShelterById, 
  createShelter, 
  updateShelter,
  deleteShelter
} = require('../Controller/ShelterController');

// Получить все приюты
router.get('/', getAllShelters);

// Получить приют по ID
router.get('/:id', getShelterById);

// Создать приют
router.post('/', createShelter);

// Обновить приют
router.put('/:id', updateShelter);

// Удалить приют
router.delete('/:id', deleteShelter);

module.exports = router;