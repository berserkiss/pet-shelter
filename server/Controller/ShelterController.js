const Shelter = require('../Model/ShelterModel');
const Pet = require('../Model/PetModel');

// Get all shelters
const getAllShelters = async (req, res) => {
  try {
    // Параметры фильтрации из запроса
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
};

// Get shelter by ID
const getShelterById = async (req, res) => {
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
};

// Create shelter
const createShelter = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    
    // Проверка на существование приюта с таким же названием (без учета регистра)
    const existingShelterName = await Shelter.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });
    
    if (existingShelterName) {
      return res.status(400).json({ 
        error: 'Приют с таким названием уже существует',
        field: 'name',
        code: 'DUPLICATE_NAME'
      });
    }

    // Проверка на существование приюта с таким же email
    const existingShelterEmail = await Shelter.findOne({ 
      email: { $regex: new RegExp(`^${email}$`, 'i') }
    });
    
    if (existingShelterEmail) {
      return res.status(400).json({ 
        error: 'Приют с таким email уже существует',
        field: 'email',
        code: 'DUPLICATE_EMAIL'
      });
    }

    // Проверка на существование приюта с таким же телефоном
    const existingShelterPhone = await Shelter.findOne({ phone });
    
    if (existingShelterPhone) {
      return res.status(400).json({ 
        error: 'Приют с таким номером телефона уже существует',
        field: 'phone',
        code: 'DUPLICATE_PHONE'
      });
    }
    
    const shelter = await Shelter.create(req.body);

    // Отправляем событие WebSocket о создании приюта
    const io = req.app.get('io');
    if (io) {
      // Используем единый тип события 'shelterUpdate' для всех изменений приютов
      io.emit('shelterUpdate', shelter);
      // Также отправляем в комнату shelters
      io.to('shelters').emit('shelterUpdate', shelter);
      console.log(`WebSocket: Отправлено событие о создании приюта ${shelter.name}`);
    }

    res.status(201).json(shelter);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update shelter
const updateShelter = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, city } = req.body;
    
    // Получаем старые данные приюта для сравнения
    const oldShelter = await Shelter.findById(id);
    if (!oldShelter) {
      return res.status(404).json({ error: 'Приют не найден' });
    }
    
    // Проверка на существование приюта с таким же названием (без учета регистра)
    const existingShelterName = await Shelter.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      _id: { $ne: id } // Исключаем текущий приют из проверки
    });
    
    if (existingShelterName) {
      return res.status(400).json({ 
        error: 'Приют с таким названием уже существует',
        field: 'name',
        code: 'DUPLICATE_NAME'
      });
    }

    // Проверка на существование приюта с таким же email
    const existingShelterEmail = await Shelter.findOne({ 
      email: { $regex: new RegExp(`^${email}$`, 'i') },
      _id: { $ne: id } // Исключаем текущий приют из проверки
    });
    
    if (existingShelterEmail) {
      return res.status(400).json({ 
        error: 'Приют с таким email уже существует',
        field: 'email',
        code: 'DUPLICATE_EMAIL'
      });
    }

    // Проверка на существование приюта с таким же телефоном
    const existingShelterPhone = await Shelter.findOne({ 
      phone,
      _id: { $ne: id } // Исключаем текущий приют из проверки
    });
    
    if (existingShelterPhone) {
      return res.status(400).json({ 
        error: 'Приют с таким номером телефона уже существует',
        field: 'phone',
        code: 'DUPLICATE_PHONE'
      });
    }
    
    // Обновляем приют
    const shelter = await Shelter.findByIdAndUpdate(id, req.body, { new: true });
    
    if (!shelter) {
      return res.status(404).json({ error: 'Приют не найден' });
    }
    
    // Если город приюта изменился - обновляем город у всех животных этого приюта
    if (city && oldShelter.city !== city) {
      const updateResult = await Pet.updateMany(
        { shelter_id: id },
        { $set: { area: city } }
      );
      console.log(`🏙️ Город приюта изменен с "${oldShelter.city}" на "${city}". Обновлено животных: ${updateResult.modifiedCount}`);
      
      // Отправляем событие WebSocket об обновлении животных
      const io = req.app.get('io');
      if (io) {
        io.emit('petsAreaUpdated', { 
          shelterId: id, 
          oldCity: oldShelter.city, 
          newCity: city, 
          count: updateResult.modifiedCount 
        });
      }
    }
    
    // Отправляем событие WebSocket об обновлении приюта
    const io = req.app.get('io');
    if (io) {
      // Используем единый тип события 'shelterUpdate' для всех изменений приютов
      io.emit('shelterUpdate', shelter);
      // Также отправляем в комнату shelters
      io.to('shelters').emit('shelterUpdate', shelter);
      console.log(`WebSocket: Отправлено событие об обновлении приюта ${shelter.name}`);
    }
    
    res.status(200).json(shelter);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete shelter
const deleteShelter = async (req, res) => {
  try {
    const { id } = req.params;
    const shelter = await Shelter.findByIdAndDelete(id);
    
    if (!shelter) {
      return res.status(404).json({ error: 'Приют не найден' });
    }
    
    // Отправляем событие WebSocket об удалении приюта
    const io = req.app.get('io');
    if (io) {
      io.emit('shelterDeleted', { id: shelter._id, name: shelter.name });
      // Также отправляем в комнату shelters
      io.to('shelters').emit('shelterDeleted', { id: shelter._id, name: shelter.name });
      console.log(`WebSocket: Отправлено событие об удалении приюта ${shelter.name}`);
    }
    
    res.status(200).json({ message: 'Приют успешно удален' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getAllShelters,
  getShelterById,
  createShelter,
  updateShelter,
  deleteShelter
}; 