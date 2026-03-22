const express = require('express');
const router = express.Router();
const Pet = require('../Model/PetModel');
const { recognizeImage, recognizeDescription, uploadMiddleware } = require('../Controller/PetImageRecognitionController');

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    return value.split(',').map(item => item.trim()).filter(Boolean);
  }
  return [];
};

const toBoolean = (value) => {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
  }
  return Boolean(value);
};

// Маршрут для получения всех одобренных питомцев (доступен без авторизации)
router.get('/', async (req, res) => {
  try {
    const pets = await Pet.find({ status: 'Approved' });
    res.status(200).json(pets);
  } catch (error) {
    console.error("Error fetching approved pets:", error);
    res.status(500).json({ error: error.message });
  }
});

// Дублирующий маршрут для обратной совместимости с клиентским кодом
router.get('/approvedPets', async (req, res) => {
  try {
    const pets = await Pet.find({ status: 'Approved' });
    res.status(200).json(pets);
  } catch (error) {
    console.error("Error fetching approved pets:", error);
    res.status(500).json({ error: error.message });
  }
});

// Маршрут для получения пород для конкретного типа животного
router.get('/breeds/:type', async (req, res) => {
  try {
    const { type } = req.params;
    
    // Находим всех питомцев одобренного типа
    const pets = await Pet.find({
      $or: [
        { type: type },
        { species: type }
      ],
      status: 'Approved'
    });
    
    // Извлекаем уникальные породы
    const breeds = [...new Set(pets.map(pet => pet.breed))];
    
    res.status(200).json(breeds);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Маршрут для получения всех видов животных
router.get('/species', async (req, res) => {
  try {
    // Находим всех питомцев и получаем уникальные виды
    const pets = await Pet.find({});
    const species = [...new Set(pets.map(pet => pet.species))].filter(Boolean);
    
    // Сортируем список для удобства
    species.sort();
    
    res.status(200).json(species);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Маршрут для получения всех уникальных черт характера
router.get('/temperaments', async (req, res) => {
  try {
    // Находим всех питомцев и получаем уникальные черты характера
    const pets = await Pet.find({});
    const temperamentSet = new Set();
    
    pets.forEach(pet => {
      if (Array.isArray(pet.temperamentTraits)) {
        pet.temperamentTraits
          .filter(Boolean)
          .forEach(trait => temperamentSet.add(trait));
      }
    });
    
    const temperaments = Array.from(temperamentSet);
    temperaments.sort();
    
    res.status(200).json(temperaments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Карточка питомца по ID: одобренные (каталог) и усыновлённые (избранное, ссылка «Просмотр»)
router.get('/:id', async (req, res) => {
  // Проверяем, не является ли параметр 'filter'
  if (req.params.id === 'filter') {
    return handleFilter(req, res);
  }

  try {
    const { id } = req.params;
    const pet = await Pet.findOne({
      _id: id,
      status: { $in: ['Approved', 'Adopted'] }
    });

    if (!pet) {
      return res.status(404).json({ error: 'Pet not found or not available for viewing' });
    }

    res.status(200).json(pet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Функция-обработчик для фильтрации питомцев
const handleFilter = async (req, res) => {
  try {
    const {
      species,
      breed,
      minAge,
      maxAge,
      sizes,
      energyLevels,
      careLevels,
      activityNeeds,
      temperaments,
      kidFriendly,
      petFriendly,
      hypoallergenic
    } = req.query;

    const filter = { status: 'Approved' };

    if (species) filter.species = species;
    if (breed) filter.breed = new RegExp(breed, 'i');
    
    const sizeList = toArray(sizes);
    if (sizeList.length) {
      filter.size = { $in: sizeList };
    }

    const energyList = toArray(energyLevels);
    if (energyList.length) {
      filter.energyLevel = { $in: energyList };
    }

    const careList = toArray(careLevels);
    if (careList.length) {
      filter.careLevel = { $in: careList };
    }

    const activityList = toArray(activityNeeds);
    if (activityList.length) {
      filter.activityNeeds = { $in: activityList };
    }

    const temperamentList = toArray(temperaments);
    if (temperamentList.length) {
      filter.temperamentTraits = { $in: temperamentList };
    }

    const kidFriendlyBool = toBoolean(kidFriendly);
    if (kidFriendlyBool === true) {
      filter.isKidFriendly = true;
    }

    const petFriendlyBool = toBoolean(petFriendly);
    if (petFriendlyBool === true) {
      filter.isPetFriendly = true;
    }

    const hypoallergenicBool = toBoolean(hypoallergenic);
    if (hypoallergenicBool === true) {
      filter.hypoallergenic = true;
    }
    
    // Обработка возрастной фильтрации
    if (minAge || maxAge) {
      const today = new Date();
      
      if (minAge) {
        const minAgeValue = parseFloat(minAge);
        const minAgeDate = new Date(today);
        
        if (minAgeValue < 1) {
          minAgeDate.setMonth(today.getMonth() - Math.round(minAgeValue * 12));
        } else {
          minAgeDate.setFullYear(today.getFullYear() - minAgeValue);
        }
        
        filter.birthDate = filter.birthDate || {};
        filter.birthDate.$lte = minAgeDate;
      }
      
      if (maxAge) {
        const maxAgeValue = parseFloat(maxAge);
        const maxAgeDate = new Date(today);
        
        if (maxAgeValue < 1) {
          maxAgeDate.setMonth(today.getMonth() - Math.round(maxAgeValue * 12));
        } else {
          maxAgeDate.setFullYear(today.getFullYear() - maxAgeValue);
        }
        
        filter.birthDate = filter.birthDate || {};
        filter.birthDate.$gte = maxAgeDate;
      }
    }

    const pets = await Pet.find(filter)
      .populate('shelter_id', 'name city street house contact')
      .sort({ createdAt: -1 });

    res.status(200).json(pets);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Маршрут для распознавания породы и вида по фото
router.post('/recognize-image', uploadMiddleware, recognizeImage);

// Маршрут для распознавания породы и вида по описанию
router.post('/recognize-description', recognizeDescription);

module.exports = router; 