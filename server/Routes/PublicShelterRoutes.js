const express = require('express');
const router = express.Router();
const Shelter = require('../Model/ShelterModel');

// Маршрут для получения всех приютов
router.get('/', async (req, res) => {
  try {
    const { city, minCapacity, maxCapacity } = req.query;
    
    // Базовый фильтр
    let filter = {};
    
    // Добавляем фильтр по городу если указан
    if (city) {
      filter.city = { $regex: new RegExp(city, 'i') };
    }
    
    // Добавляем фильтр по заполненности
    if (minCapacity) {
      filter.current_capacity = { ...filter.current_capacity, $gte: parseInt(minCapacity) };
    }
    if (maxCapacity) {
      filter.current_capacity = { ...filter.current_capacity, $lte: parseInt(maxCapacity) };
    }
    
    // Получаем приюты по фильтру
    const shelters = await Shelter.find(filter);
    
    res.status(200).json(shelters);
  } catch (error) {
    console.error("Error fetching shelters:", error);
    res.status(500).json({ error: error.message });
  }
});

// Маршрут для получения приюта по ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const shelter = await Shelter.findById(id);
    
    if (!shelter) {
      return res.status(404).json({ error: 'Приют не найден' });
    }
    
    res.status(200).json(shelter);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 