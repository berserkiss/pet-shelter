const Pet = require('../Model/PetModel');
const Shelter = require('../Model/ShelterModel');
const Favorite = require('../Model/FavoriteModel');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const Volunteer = require('../Model/VolunteerModel');
const { getClientBaseUrl } = require('../utils/clientBaseUrl');
const { uploadPetImage, deletePetImage } = require('../utils/cloudinary');
const { getShelterCapacityDelta, safeDecrementCapacity } = require('../utils/domainRules');

const postPetRequest = async (req, res) => {
    try {
        let { 
            name, birthDate, area, justification, email, phone, type, species, breed, description, 
            shelter_id, user_id, size, energyLevel, careLevel, activityNeeds, temperamentTraits,
            isKidFriendly, isPetFriendly, hypoallergenic, medicalNotes
        } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: 'Picture required' });
        }

        const filename = await uploadPetImage(req.file);
        
        // Обработка массива черт характера (может прийти как массив или как строка)
        let processedTemperamentTraits = [];
        if (temperamentTraits) {
            if (Array.isArray(temperamentTraits)) {
                processedTemperamentTraits = temperamentTraits;
            } else if (typeof temperamentTraits === 'string') {
                processedTemperamentTraits = [temperamentTraits];
            }
        }
        
        // Валидация характеристик: проверка окончания на "ий" или "ый" и отсутствие дубликатов
        const validateTemperamentTraits = (traits) => {
            if (!Array.isArray(traits)) return { valid: true, traits: [] };
            
            const seen = new Set();
            const uniqueTraits = [];
            
            for (const trait of traits) {
                if (!trait || typeof trait !== 'string') continue;
                
                // Извлекаем базовую часть (до "(-")
                let baseTrait = trait.trim();
                if (baseTrait.includes('(-')) {
                    baseTrait = baseTrait.split('(-')[0].trim();
                }
                
                // Проверяем окончание на "ий" или "ый"
                if (!baseTrait.endsWith('ий') && !baseTrait.endsWith('ый')) {
                    return {
                        valid: false,
                        error: `Характеристика "${trait}" должна заканчиваться на "ий" или "ый" (например: дружелюбный, милый)`
                    };
                }
                
                // Проверяем на дубликаты (без учета регистра)
                const normalizedTrait = trait.toLowerCase();
                if (seen.has(normalizedTrait)) {
                    return {
                        valid: false,
                        error: `Обнаружена повторяющаяся характеристика: "${trait}"`
                    };
                }
                
                seen.add(normalizedTrait);
                uniqueTraits.push(trait);
            }
            
            return { valid: true, traits: uniqueTraits };
        };
        
        const validationResult = validateTemperamentTraits(processedTemperamentTraits);
        if (!validationResult.valid) {
            return res.status(400).json({ error: validationResult.error });
        }
        processedTemperamentTraits = validationResult.traits;

        // 1. Проверяем существование приюта
        const shelter = await Shelter.findById(shelter_id);
        if (!shelter) {
            return res.status(404).json({ error: 'Shelter not found' });
        }

        // 2. Проверяем capacity приюта
        if (shelter.current_capacity >= shelter.max_capacity) {
            return res.status(400).json({ error: 'Приют заполнен до максимальной вместимости' });
        }
        
        // 3. Проверяем и нормализуем породу и вид
        // Проверка существования вида с таким же названием (без учета регистра)
        const existingSpecies = await Pet.findOne({ 
            species: { $regex: new RegExp(`^${species}$`, 'i') } 
        });
        
        if (existingSpecies) {
            // Используем существующий вид с правильным регистром
            species = existingSpecies.species;
            console.log(`Используется существующий вид: ${species}`);
        }
        
        // Проверка существования породы с таким же названием (без учета регистра)
        const existingBreed = await Pet.findOne({ 
            breed: { $regex: new RegExp(`^${breed}$`, 'i') } 
        });
        
        if (existingBreed) {
            // Используем существующую породу с правильным регистром
            breed = existingBreed.breed;
            console.log(`Используется существующая порода: ${breed}`);
        }

        // 4. Создаём питомца
        const petData = {
            name,
            birthDate,
            area,
            justification,
            email,
            phone,
            type,
            species,
            breed,
            description,
            shelter_id,
            filename,
            status: 'Pending',
            // Новые поля
            size: size || 'medium',
            energyLevel: energyLevel || 'medium',
            careLevel: careLevel || 'medium',
            activityNeeds: activityNeeds || 'moderate',
            temperamentTraits: processedTemperamentTraits,
            isKidFriendly: isKidFriendly !== undefined ? (isKidFriendly === 'true' || isKidFriendly === true) : true,
            isPetFriendly: isPetFriendly !== undefined ? (isPetFriendly === 'true' || isPetFriendly === true) : true,
            hypoallergenic: hypoallergenic !== undefined ? (hypoallergenic === 'true' || hypoallergenic === true) : false,
            medicalNotes: medicalNotes || ''
        };

        // Добавляем user_id если он был передан или получен из токена
        if (user_id) {
            petData.user_id = user_id;
        } else if (req.user && req.user._id) {
            petData.user_id = req.user._id;
        }

        const pet = await Pet.create(petData);

        // 4. Отправляем событие WebSocket о новой заявке
        const io = req.app.get('io');
        if (io) {
            io.emit('newPet', pet);
            console.log('WebSocket: Отправлено событие о новой заявке на питомца');
            
            // Отправляем событие для обновления списков видов и пород
            io.emit('speciesBreedUpdate', { species, breed });
            console.log('WebSocket: Отправлено событие об обновлении видов и пород');
            
            // Отправляем событие для обновления списка черт характера (если есть новые)
            if (processedTemperamentTraits && processedTemperamentTraits.length > 0) {
                processedTemperamentTraits.forEach(trait => {
                    io.emit('temperamentUpdate', { temperament: trait });
                });
                console.log('WebSocket: Отправлено событие об обновлении черт характера');
            }
        }

        // Отправка email-уведомления
        try {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_APP_PASS
                }
            });

            const formattedDate = new Date().toLocaleDateString('ru-RU');
            
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'Заявка на размещение питомца получена - PawFinds',
                text: `Уважаемый владелец ${name}!

Спасибо за вашу заявку на размещение питомца на платформе PawFinds.

Информация о вашей заявке:
- Имя питомца: ${name}
- Вид: ${species}
- Порода: ${breed}
- Дата подачи: ${formattedDate}
- Приют: ${shelter.name}

Ваша заявка будет рассмотрена администрацией в ближайшее время. После проверки и подтверждения, ваш питомец появится в общем списке и станет доступен для усыновления.

Мы сообщим вам о результатах рассмотрения заявки по указанному email адресу.

Если у вас возникнут вопросы, пожалуйста, свяжитесь с нами, ответив на это письмо.

С уважением,
Команда PawFinds`,
                html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h2 style="color: #6504b5;">Заявка на размещение питомца получена</h2>
                    </div>
                    
                    <p>Уважаемый владелец ${name}!</p>
                    
                    <p>Спасибо за вашу заявку на размещение питомца на платформе PawFinds.</p>
                    
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <h3 style="margin-top: 0; color: #6504b5;">Информация о заявке:</h3>
                        <p><strong>Имя питомца:</strong> ${name}</p>
                        <p><strong>Вид:</strong> ${species}</p>
                        <p><strong>Порода:</strong> ${breed}</p>
                        <p><strong>Дата подачи:</strong> ${formattedDate}</p>
                        <p><strong>Приют:</strong> ${shelter.name}</p>
                    </div>
                    
                    <p>Ваша заявка будет рассмотрена администрацией в ближайшее время. После проверки и подтверждения, ваш питомец появится в общем списке и станет доступен для усыновления.</p>
                    
                    <p>Мы сообщим вам о результатах рассмотрения заявки по указанному email адресу.</p>
                    
                    <p>Если у вас возникнут вопросы, пожалуйста, свяжитесь с нами, ответив на это письмо.</p>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                        <p style="margin-bottom: 5px;"><strong>С уважением,</strong></p>
                        <p style="margin-top: 0;">Команда PawFinds</p>
                    </div>
                </div>
                `
            };

            await transporter.sendMail(mailOptions);
            console.log(`Email notification sent to ${email} for pet submission`);
        } catch (emailError) {
            console.error('Error sending submission email:', emailError);
            // Не блокируем основной процесс, если отправка email не удалась
        }

        res.status(200).json(pet);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const approveRequest = async (req, res) => {
  try {
    const id = req.params.id;
    const { email, phone, status, adopter_email, adopter_id, user_id } = req.body;
    
    // Create update object
    const updateData = { email, phone, status };
    
    // If status is "Adopted", also set the adopter_email and adopter_id fields
    if (status === "Adopted") {
      updateData.adopter_email = adopter_email || email;
      // Add adopter_id if provided
      if (adopter_id) {
        updateData.adopter_id = adopter_id;
      }
    }

    // Если передан user_id, сохраняем его в записи питомца
    // Это позволит показывать одобренных питомцев в профиле пользователя
    if (user_id) {
      updateData.user_id = user_id;
    }
    
    // Get pet before update to check current status
    const oldPet = await Pet.findById(id);
    if (!oldPet) {
      return res.status(404).json({ error: 'Pet not found' });
    }
    
    // Update pet with all fields
    const pet = await Pet.findByIdAndUpdate(id, updateData, { new: true });

    // Если статус изменился на "Approved", увеличиваем capacity приюта
    if (status === "Approved" && oldPet.status !== "Approved") {
      const shelter = await Shelter.findById(pet.shelter_id);
      if (shelter) {
        // Проверяем, не заполнен ли приют
        if (shelter.current_capacity >= shelter.max_capacity) {
          return res.status(400).json({ error: 'Приют заполнен до максимальной вместимости' });
        }
        
        shelter.current_capacity += 1;
        await shelter.save();
        
        // Отправляем событие об обновлении приюта
        const io = req.app.get('io');
        if (io) {
          io.emit('shelterUpdate', shelter);
          // Также отправляем в комнату shelters
          io.to('shelters').emit('shelterUpdate', shelter);
          
          // Отправляем обновления пользователям, у которых есть волонтерские заявки в этом приюте
          try {
            const volunteers = await Volunteer.find({ shelter_id: shelter._id });
            // Отправляем обновление каждому пользователю
            volunteers.forEach(volunteer => {
              if (volunteer.email) {
                io.to(`user:${volunteer.email}`).emit('shelterUpdate', shelter);
              }
              if (volunteer.user_id) {
                io.to(`userId:${volunteer.user_id}`).emit('shelterUpdate', shelter);
              }
            });
            console.log(`WebSocket: Отправлено событие об обновлении приюта ${shelter.name} волонтерам (${volunteers.length})`);
          } catch (err) {
            console.error(`Ошибка при отправке обновлений волонтерам:`, err);
          }
          
          console.log(`WebSocket: Отправлено событие об обновлении вместимости приюта ${shelter.name}`);
        }
      }
    }
    
    // Если статус изменился на "Adopted", уменьшаем capacity приюта
    if (status === "Adopted" && oldPet.status !== "Adopted") {
      const shelter = await Shelter.findById(pet.shelter_id);
      if (shelter) {
        shelter.current_capacity = Math.max(0, shelter.current_capacity - 1);
        await shelter.save();
        
        // Отправляем событие об обновлении приюта
        const io = req.app.get('io');
        if (io) {
          io.emit('shelterUpdate', shelter);
          // Также отправляем в комнату shelters
          io.to('shelters').emit('shelterUpdate', shelter);
          console.log(`WebSocket: Отправлено событие об обновлении вместимости приюта ${shelter.name}`);
        }
      }
    }

    // Emit WebSocket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      // Отправляем событие об обновлении статуса всем пользователям
      io.emit('petRequestUpdate', pet);
      console.log(`WebSocket: Отправлено событие об обновлении статуса питомца на ${status}`);
      
      // Если статус изменился на "Adopted", отправляем событие для календаря ухода
      // (новый владелец может захотеть создать календарь)
      if (status === "Adopted" && adopter_email) {
        io.to(`user:${adopter_email}`).emit('petRequestUpdate', pet);
        io.emit('petCareCalendarUpdate', {
          petId: pet._id,
          pet: pet,
          fieldsChanged: ['status'],
          message: 'Питомец усыновлен - можно создать календарь ухода'
        });
        console.log(`WebSocket: Отправлено персональное уведомление пользователю ${adopter_email} об усыновлении питомца`);
      }
      
      // Если статус изменился на "Approved", отправляем дополнительное уведомление
      if (status === "Approved") {
        console.log(`WebSocket: Питомец ${pet.name} одобрен и доступен для усыновления`);
      }
    }

    // Получаем информацию о приюте для включения в email
    const shelter = await Shelter.findById(pet.shelter_id);
    const shelterName = shelter ? shelter.name : 'Не указан';
    const shelterAddress = shelter ? `${shelter.city}, ${shelter.street}, ${shelter.house}` : 'Не указан';

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_APP_PASS
      }
    });
  
    // Определяем содержимое письма в зависимости от статуса
    let emailSubject, emailText, emailHtml;
    
    if (status === 'Approved') {
      emailSubject = 'Ваш питомец размещен на PawFinds';
      emailText = `Уважаемый владелец ${pet.name}!

Отличные новости! Ваш питомец прошел проверку и теперь размещен на платформе PawFinds.

Информация о размещенном питомце:
- Имя: ${pet.name}
- Вид: ${pet.species}
- Порода: ${pet.breed}
- Приют: ${shelterName}
- Адрес приюта: ${shelterAddress}

Теперь пользователи нашей платформы смогут просматривать информацию о вашем питомце и подавать заявки на усыновление. Мы будем уведомлять вас о каждой полученной заявке.

Вы можете просмотреть информацию о вашем питомце, авторизовавшись на нашем сайте.

Если у вас возникнут вопросы или потребуется дополнительная информация, пожалуйста, свяжитесь с нами, ответив на это письмо.

Спасибо за ваш вклад в наше сообщество и помощь в поиске нового дома для питомцев!

С уважением,
Команда PawFinds`;
      emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="color: #6504b5;">Ваш питомец размещен на PawFinds</h2>
          </div>
          
          <p>Уважаемый владелец ${pet.name}!</p>
          
          <p>Отличные новости! Ваш питомец прошел проверку и теперь размещен на платформе PawFinds.</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <h3 style="margin-top: 0; color: #6504b5;">Информация о размещенном питомце:</h3>
              <p><strong>Имя:</strong> ${pet.name}</p>
              <p><strong>Вид:</strong> ${pet.species}</p>
              <p><strong>Порода:</strong> ${pet.breed}</p>
              <p><strong>Приют:</strong> ${shelterName}</p>
              <p><strong>Адрес приюта:</strong> ${shelterAddress}</p>
          </div>
          
          <p>Теперь пользователи нашей платформы смогут просматривать информацию о вашем питомце и подавать заявки на усыновление. Мы будем уведомлять вас о каждой полученной заявке.</p>
          
          <p>Вы можете просмотреть информацию о вашем питомце, авторизовавшись на нашем сайте.</p>
          
          <p>Если у вас возникнут вопросы или потребуется дополнительная информация, пожалуйста, свяжитесь с нами, ответив на это письмо.</p>
          
          <p>Спасибо за ваш вклад в наше сообщество и помощь в поиске нового дома для питомцев!</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
              <p style="margin-bottom: 5px;"><strong>С уважением,</strong></p>
              <p style="margin-top: 0;">Команда PawFinds</p>
          </div>
      </div>
      `;
    } else if (status === 'Rejected') {
      emailSubject = 'Ваша заявка на размещение питомца на PawFinds отклонена';
      emailText = `Уважаемый владелец ${pet.name}!

К сожалению, ваша заявка на размещение питомца на платформе PawFinds была отклонена.

Информация о заявке:
- Имя питомца: ${pet.name}
- Вид: ${pet.species}
- Порода: ${pet.breed}

Причины отклонения заявки могут включать:
- Недостаточно подробное описание питомца
- Отсутствие необходимой информации
- Несоответствие требованиям платформы
- Ограниченная вместимость выбранного приюта

Если вы хотите получить более подробную информацию о причинах отклонения или подать новую заявку, пожалуйста, свяжитесь с нами, ответив на это письмо.

С уважением,
Команда PawFinds`;
      emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
              <h2 style="color: #6504b5;">Заявка на размещение питомца отклонена</h2>
          </div>
          
          <p>Уважаемый владелец ${pet.name}!</p>
          
          <p>К сожалению, ваша заявка на размещение питомца на платформе PawFinds была отклонена.</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <h3 style="margin-top: 0; color: #6504b5;">Информация о заявке:</h3>
              <p><strong>Имя питомца:</strong> ${pet.name}</p>
              <p><strong>Вид:</strong> ${pet.species}</p>
              <p><strong>Порода:</strong> ${pet.breed}</p>
          </div>
          
          <div style="background-color: #fff8e1; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #ffb74d;">
              <h3 style="margin-top: 0; color: #e65100;">Возможные причины отклонения:</h3>
              <ul style="margin-bottom: 0; padding-left: 20px;">
                  <li>Недостаточно подробное описание питомца</li>
                  <li>Отсутствие необходимой информации</li>
                  <li>Несоответствие требованиям платформы</li>
                  <li>Ограниченная вместимость выбранного приюта</li>
              </ul>
          </div>
          
          <p>Если вы хотите получить более подробную информацию о причинах отклонения или подать новую заявку, пожалуйста, свяжитесь с нами, ответив на это письмо.</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
              <p style="margin-bottom: 5px;"><strong>С уважением,</strong></p>
              <p style="margin-top: 0;">Команда PawFinds</p>
          </div>
      </div>
      `;
    }
    
    // Отправляем email только если статус - Approved или Rejected
    if (status === 'Approved' || status === 'Rejected') {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: pet.email,
        subject: emailSubject,
        text: emailText,
        html: emailHtml
    };
  
    try {
      await transporter.sendMail(mailOptions);
        console.log(`Email notification sent to ${pet.email} for pet ${pet.name} with status ${status}`);
    } catch (error) {
        console.error(`Error sending ${status} email:`, error);
      // Не блокируем основной процесс, если отправка email не удалась
      }
    }
  
    res.status(200).json(pet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const allPets = async (status, req, res) => {
  try {
    let pets;
    if (status === null) {
      // Если статус null, возвращаем все питомцы
      pets = await Pet.find({});
      console.log(`Found ${pets.length} pets (all statuses)`);
    } else {
      // Иначе фильтруем по указанному статусу
      pets = await Pet.find({ status });
    console.log(`Found ${pets.length} pets with status: ${status}`);
    }
    res.status(200).json(pets);
  } catch (error) {
    console.error("Error in allPets:", error);
    res.status(500).json({ error: error.message });
  }
};

const deletePost = async (req, res) => {
    try {
        const id = req.params.id;

        // 1. Находим питомца
        const pet = await Pet.findById(id);
        if (!pet) {
            return res.status(404).json({ error: 'Pet not found' });
        }

        // 2. Удаляем все заявки на усыновление этого питомца
        const AdoptForm = require('../Model/AdoptFormModel');
        
        // Сначала получаем все заявки для отправки уведомлений
        const formsToDelete = await AdoptForm.find({ petId: id });
        console.log(`Found ${formsToDelete.length} adoption forms to delete for pet ${pet.name}`);
        
        // Удаляем заявки
        const deletedForms = await AdoptForm.deleteMany({ petId: id });
        console.log(`Deleted ${deletedForms.deletedCount} adoption forms for pet ${pet.name}`);

        // 3. Получаем список пользователей, у которых питомец в избранном, и удаляем записи
        const favoritesToDelete = await Favorite.find({ pet_id: id }).select('user_id');
        const deletedFavorites = await Favorite.deleteMany({ pet_id: id });
        console.log(`Deleted ${deletedFavorites.deletedCount} favorite records for pet ${pet.name}`);

        // 4. Удаляем фотографию питомца
        if (pet.filename) {
            await deletePetImage(pet.filename);
        }

        // 5. Удаляем питомца из базы данных
        await Pet.findByIdAndDelete(id);

        // 6. Находим приют и уменьшаем capacity, если питомец занимал место
        const shelter = await Shelter.findById(pet.shelter_id);
        if (shelter && (pet.status === 'Approved' || pet.status === 'InReview')) {
            shelter.current_capacity = safeDecrementCapacity(shelter.current_capacity);
            await shelter.save();
        }
            
        // 7. Отправляем все WebSocket события
            const io = req.app.get('io');
            if (io) {
            // Уведомления об удалении заявок
            if (formsToDelete.length > 0) {
                formsToDelete.forEach(form => {
                    // Уведомляем пользователя об удалении его заявки
                    io.to(`user:${form.email}`).emit('applicationDeleted', {
                        formId: form._id,
                        petName: pet.name,
                        reason: 'pet_deleted'
                    });
                    
                    // Уведомляем администраторов об удалении заявки
                    io.emit('formDeleted', { id: form._id });
                });
                console.log(`WebSocket: Отправлены уведомления об удалении ${formsToDelete.length} заявок`);
            }

            // Уведомление об обновлении приюта
            if (shelter) {
                io.emit('shelterUpdate', shelter);
                io.to('shelters').emit('shelterUpdate', shelter);
                console.log(`WebSocket: Отправлено событие об обновлении вместимости приюта ${shelter.name}`);
            }

            // Уведомления об удалении из избранного
            if (favoritesToDelete.length > 0) {
                favoritesToDelete.forEach(favorite => {
                    // Уведомляем пользователя об удалении питомца из избранного
                    io.to(`user:${favorite.user_id}`).emit('favoriteRemoved', {
                        user_id: favorite.user_id.toString(),
                        pet_id: pet._id.toString()
                    });
                });
                console.log(`WebSocket: Отправлены уведомления об удалении из избранного для ${favoritesToDelete.length} пользователей`);
            }

            // Уведомление об удалении питомца
            io.emit('petDeleted', { id: pet._id });
            console.log(`WebSocket: Отправлено событие об удалении питомца ${pet._id}`);
        }

        // 8. Отправляем email уведомления
        try {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_APP_PASS
                }
            });

            const shelterName = shelter ? shelter.name : 'Не указан';
            
            // Отправляем уведомления заявителям
            if (formsToDelete.length > 0) {
                const emailPromises = formsToDelete.map(async (form) => {
                    try {
            const mailOptions = {
                            from: process.env.EMAIL_USER,
                            to: form.email,
                            subject: `Заявка на усыновление отменена - PawFinds`,
                            text: `Уважаемый пользователь,

К сожалению, ваша заявка на усыновление питомца ${pet.name} была отменена, так как объявление о питомце было удалено с платформы.

Информация о питомце:
- Имя: ${pet.name}
- Вид: ${pet.species}
- Порода: ${pet.breed}

Это могло произойти по следующим причинам:
- Питомец был усыновлен напрямую через приют
- Владелец отозвал заявку на размещение
- Объявление не соответствовало правилам платформы

Мы приглашаем вас рассмотреть других питомцев, которые ищут дом на нашей платформе.

С уважением,
Команда PawFinds`,
                            html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                                <div style="text-align: center; margin-bottom: 20px;">
                                    <h2 style="color: #6504b5;">Заявка на усыновление отменена</h2>
                                </div>
                                
                                <p>Уважаемый пользователь,</p>
                                
                                <p>К сожалению, ваша заявка на усыновление питомца <strong>${pet.name}</strong> была отменена, так как объявление о питомце было удалено с платформы.</p>
                                
                                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
                                    <h3 style="margin-top: 0; color: #6504b5;">Информация о питомце:</h3>
                                    <p><strong>Имя:</strong> ${pet.name}</p>
                                    <p><strong>Вид:</strong> ${pet.species}</p>
                                    <p><strong>Порода:</strong> ${pet.breed}</p>
                                </div>
                                
                                <div style="background-color: #fff8e1; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #ffb74d;">
                                    <h3 style="margin-top: 0; color: #e65100;">Возможные причины:</h3>
                                    <ul style="margin-bottom: 0; padding-left: 20px;">
                                        <li>Питомец был усыновлен напрямую через приют</li>
                                        <li>Владелец отозвал заявку на размещение</li>
                                        <li>Объявление не соответствовало правилам платформы</li>
                                    </ul>
                                </div>
                                
                                <p>Мы приглашаем вас рассмотреть других питомцев, которые ищут дом на нашей платформе.</p>
                                
                                <div style="text-align: center; margin: 20px 0;">
                                    <a href="${getClientBaseUrl()}/pets" style="background-color: #6504b5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Посмотреть других питомцев</a>
                                </div>
                                
                                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                                    <p style="margin-bottom: 5px;"><strong>С уважением,</strong></p>
                                    <p style="margin-top: 0;">Команда PawFinds</p>
                                </div>
                            </div>
                            `
                        };
                        
                        await transporter.sendMail(mailOptions);
                        console.log(`Deletion notification email sent to ${form.email} for cancelled adoption application`);
                    } catch (emailError) {
                        console.error(`Error sending deletion notification to ${form.email}:`, emailError);
                    }
                });

                await Promise.all(emailPromises);
            }

            // Отправляем уведомление владельцу питомца
            const ownerMailOptions = {
                from: process.env.EMAIL_USER,
                to: pet.email,
                subject: 'Ваше объявление о питомце удалено - PawFinds',
                text: `Уважаемый владелец ${pet.name}!

Мы хотим сообщить вам, что ваше объявление о питомце ${pet.name} было удалено с платформы PawFinds.

Информация об удаленном объявлении:
- Имя питомца: ${pet.name}
- Вид: ${pet.species}
- Порода: ${pet.breed}
- Приют: ${shelterName}

Возможные причины удаления объявления:
- Питомец был успешно усыновлен
- Объявление не соответствовало нашим правилам
- Владелец запросил удаление
- Истек срок размещения объявления

Если у вас возникли вопросы по поводу удаления вашего объявления, пожалуйста, свяжитесь с нами, ответив на это письмо.

Если ваш питомец был успешно усыновлен, поздравляем! Нам очень приятно, что наша платформа помогла найти новый дом для вашего питомца.

С уважением,
Команда PawFinds`,
                html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h2 style="color: #6504b5;">Объявление о питомце удалено</h2>
                    </div>
                    
                    <p>Уважаемый владелец ${pet.name}!</p>
                    
                    <p>Мы хотим сообщить вам, что ваше объявление о питомце ${pet.name} было удалено с платформы PawFinds.</p>
                    
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <h3 style="margin-top: 0; color: #6504b5;">Информация об удаленном объявлении:</h3>
                        <p><strong>Имя питомца:</strong> ${pet.name}</p>
                        <p><strong>Вид:</strong> ${pet.species}</p>
                        <p><strong>Порода:</strong> ${pet.breed}</p>
                        <p><strong>Приют:</strong> ${shelterName}</p>
                    </div>
                    
                    <div style="background-color: #fff8e1; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #ffb74d;">
                        <h3 style="margin-top: 0; color: #e65100;">Возможные причины удаления:</h3>
                        <ul style="margin-bottom: 0; padding-left: 20px;">
                            <li>Питомец был успешно усыновлен</li>
                            <li>Объявление не соответствовало нашим правилам</li>
                            <li>Владелец запросил удаление</li>
                            <li>Истек срок размещения объявления</li>
                        </ul>
                    </div>
                    
                    <p>Если у вас возникли вопросы по поводу удаления вашего объявления, пожалуйста, свяжитесь с нами, ответив на это письмо.</p>
                    
                    <p>Если ваш питомец был успешно усыновлен, поздравляем! Нам очень приятно, что наша платформа помогла найти новый дом для вашего питомца.</p>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                        <p style="margin-bottom: 5px;"><strong>С уважением,</strong></p>
                        <p style="margin-top: 0;">Команда PawFinds</p>
                    </div>
                </div>
                `
            };

            await transporter.sendMail(ownerMailOptions);
            console.log(`Deletion notification email sent to ${pet.email} for pet ${pet.name}`);
        } catch (emailError) {
            console.error('Error sending removal email:', emailError);
            // Не блокируем основной процесс, если отправка email не удалась
        }

        res.status(200).json({ message: 'Pet deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const parseList = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'string') {
        return value.split(',').map(item => item.trim()).filter(Boolean);
    }
    return [];
};

const parseBoolean = (value) => {
    if (value === undefined) return undefined;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
    }
    return Boolean(value);
};

const getFilteredPets = async (req, res) => {
    try {
        const {
            species,
            breed,
            minAge,
            maxAge,
            shelterId,
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

        const sizeList = parseList(sizes);
        if (sizeList.length) {
            filter.size = { $in: sizeList };
        }

        const energyList = parseList(energyLevels);
        if (energyList.length) {
            filter.energyLevel = { $in: energyList };
        }

        const careList = parseList(careLevels);
        if (careList.length) {
            filter.careLevel = { $in: careList };
        }

        const activityList = parseList(activityNeeds);
        if (activityList.length) {
            filter.activityNeeds = { $in: activityList };
        }

        const temperamentList = parseList(temperaments);
        if (temperamentList.length) {
            filter.temperamentTraits = { $in: temperamentList };
        }

        const kidFriendlyBool = parseBoolean(kidFriendly);
        if (kidFriendlyBool === true) {
            filter.isKidFriendly = true;
        }

        const petFriendlyBool = parseBoolean(petFriendly);
        if (petFriendlyBool === true) {
            filter.isPetFriendly = true;
        }

        const hypoallergenicBool = parseBoolean(hypoallergenic);
        if (hypoallergenicBool === true) {
            filter.hypoallergenic = true;
        }
        
        // Обновляем фильтрацию по возрасту для поддержки месяцев (дробных чисел)
        if (minAge || maxAge) {
            // Вычисляем даты рождения на основе минимального и максимального возраста
            const today = new Date();
            
            if (minAge) {
                // Питомцы старше minAge лет/месяцев 
                // Для преобразования в годы, делим на 12, если значение < 1
                const minAgeValue = parseFloat(minAge);
                const minAgeDate = new Date(today);
                
                if (minAgeValue < 1) {
                    // Для месяцев (например, 0.5 года = 6 месяцев)
                    minAgeDate.setMonth(today.getMonth() - Math.round(minAgeValue * 12));
                } else {
                    minAgeDate.setFullYear(today.getFullYear() - minAgeValue);
                }
                
                filter.birthDate = filter.birthDate || {};
                // Дата рождения должна быть РАНЬШЕ или РАВНА minAgeDate
                filter.birthDate.$lte = minAgeDate;
            }
            
            if (maxAge) {
                // Питомцы младше maxAge лет/месяцев
                const maxAgeValue = parseFloat(maxAge);
                const maxAgeDate = new Date(today);
                
                if (maxAgeValue < 1) {
                    // Для месяцев (например, 0.5 года = 6 месяцев)
                    maxAgeDate.setMonth(today.getMonth() - Math.round(maxAgeValue * 12));
                } else {
                    maxAgeDate.setFullYear(today.getFullYear() - maxAgeValue);
                }
                
                filter.birthDate = filter.birthDate || {};
                // Дата рождения должна быть ПОЗЖЕ или РАВНА maxAgeDate
                filter.birthDate.$gte = maxAgeDate;
            }
        }
        
        if (shelterId) filter.shelter_id = shelterId;

        const pets = await Pet.find(filter)
            .populate('shelter_id', 'name city street house contact')
            .sort({ createdAt: -1 });

        res.status(200).json(pets);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const getPetById = async (req, res) => {
  try {
    const { id } = req.params;
    const pet = await Pet.findById(id);
    
    if (!pet) {
      return res.status(404).json({ error: 'Pet not found' });
    }
    
    res.status(200).json(pet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getApprovedPetById = async (req, res) => {
  try {
    const { id } = req.params;
    const pet = await Pet.findById(id);
    
    if (!pet) {
      return res.status(404).json({ error: 'Pet not found' });
    }
    
    res.status(200).json(pet);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getBreedsForType = async (req, res) => {
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
};

const updatePet = async (req, res) => {
  try {
    const id = req.params.id;
    let { 
      name, birthDate, species, breed, description, shelter_id, area, email, phone, status,
      size, energyLevel, careLevel, activityNeeds, temperamentTraits,
      isKidFriendly, isPetFriendly, hypoallergenic, medicalNotes
    } = req.body;
    
    // Find the pet by id
    const oldPet = await Pet.findById(id);
    if (!oldPet) {
      return res.status(404).json({ error: 'Питомец не найден' });
    }
    
    // Валидация характеристик: проверка окончания на "ий" или "ый" и отсутствие дубликатов
    const validateTemperamentTraits = (traits) => {
      if (!traits || !Array.isArray(traits)) return { valid: true, traits: [] };
      
      const seen = new Set();
      const uniqueTraits = [];
      
      for (const trait of traits) {
        if (!trait || typeof trait !== 'string') continue;
        
        // Извлекаем базовую часть (до "(-")
        let baseTrait = trait.trim();
        if (baseTrait.includes('(-')) {
          baseTrait = baseTrait.split('(-')[0].trim();
        }
        
        // Проверяем окончание на "ий" или "ый"
        if (!baseTrait.endsWith('ий') && !baseTrait.endsWith('ый')) {
          return {
            valid: false,
            error: `Характеристика "${trait}" должна заканчиваться на "ий" или "ый" (например: дружелюбный, милый)`
          };
        }
        
        // Проверяем на дубликаты (без учета регистра)
        const normalizedTrait = trait.toLowerCase();
        if (seen.has(normalizedTrait)) {
          return {
            valid: false,
            error: `Обнаружена повторяющаяся характеристика: "${trait}"`
          };
        }
        
        seen.add(normalizedTrait);
        uniqueTraits.push(trait);
      }
      
      return { valid: true, traits: uniqueTraits };
    };
    
    // Обработка и валидация характеристик, если они переданы
    let processedTemperamentTraits = undefined;
    if (temperamentTraits !== undefined) {
      const processedTraits = Array.isArray(temperamentTraits) ? temperamentTraits : 
                             (typeof temperamentTraits === 'string' ? [temperamentTraits] : []);
      const validationResult = validateTemperamentTraits(processedTraits);
      if (!validationResult.valid) {
        return res.status(400).json({ error: validationResult.error });
      }
      processedTemperamentTraits = validationResult.traits;
    }
    
    // Проверяем и нормализуем породу и вид, если они были изменены
    if (species !== oldPet.species) {
      // Проверка существования вида с таким же названием (без учета регистра)
      const existingSpecies = await Pet.findOne({ 
        species: { $regex: new RegExp(`^${species}$`, 'i') },
        _id: { $ne: id } // Исключаем текущий питомец из поиска
      });
      
      if (existingSpecies) {
        // Используем существующий вид с правильным регистром
        species = existingSpecies.species;
        console.log(`Используется существующий вид: ${species}`);
      }
    }
    
    if (breed !== oldPet.breed) {
      // Проверка существования породы с таким же названием (без учета регистра)
      const existingBreed = await Pet.findOne({ 
        breed: { $regex: new RegExp(`^${breed}$`, 'i') },
        _id: { $ne: id } // Исключаем текущий питомец из поиска
      });
      
      if (existingBreed) {
        // Используем существующую породу с правильным регистром
        breed = existingBreed.breed;
        console.log(`Используется существующая порода: ${breed}`);
      }
    }
    
    // Update object for the pet
    const updateData = {
      name,
      birthDate,
      species,
      breed,
      description,
      shelter_id,
      area,
      email,
      phone,
      status
    };
    
    // Добавляем новые поля, если они переданы
    if (size !== undefined) updateData.size = size;
    if (energyLevel !== undefined) updateData.energyLevel = energyLevel;
    if (careLevel !== undefined) updateData.careLevel = careLevel;
    if (activityNeeds !== undefined) updateData.activityNeeds = activityNeeds;
    if (processedTemperamentTraits !== undefined) {
      updateData.temperamentTraits = processedTemperamentTraits;
    }
    if (isKidFriendly !== undefined) updateData.isKidFriendly = isKidFriendly === 'true' || isKidFriendly === true;
    if (isPetFriendly !== undefined) updateData.isPetFriendly = isPetFriendly === 'true' || isPetFriendly === true;
    if (hypoallergenic !== undefined) updateData.hypoallergenic = hypoallergenic === 'true' || hypoallergenic === true;
    if (medicalNotes !== undefined) updateData.medicalNotes = medicalNotes;
    
    // Check if changing shelter and update capacities accordingly
    if (oldPet.shelter_id && shelter_id !== oldPet.shelter_id.toString()) {
      // Getting the old and new shelters
      const [oldShelter, newShelter] = await Promise.all([
        Shelter.findById(oldPet.shelter_id),
        Shelter.findById(shelter_id)
      ]);
      
      if (oldShelter && (oldPet.status === 'Approved' || oldPet.status === 'InReview')) {
        // Decrease count in old shelter
        oldShelter.current_capacity = Math.max(0, oldShelter.current_capacity - 1);
        await oldShelter.save();
        
        // Emit socket event for old shelter update
        const io = req.app.get('io');
        if (io) {
          io.emit('shelterUpdate', oldShelter);
          io.to('shelters').emit('shelterUpdate', oldShelter);
        }
      }
      
      if (newShelter && (status === 'Approved' || status === 'InReview')) {
        // Check if new shelter has capacity
        if (newShelter.current_capacity >= newShelter.max_capacity) {
          return res.status(400).json({ error: 'Новый приют заполнен до максимальной вместимости' });
        }
        
        // Increase count in new shelter
        newShelter.current_capacity += 1;
        await newShelter.save();
        
        // Emit socket event for new shelter update
        const io = req.app.get('io');
        if (io) {
          io.emit('shelterUpdate', newShelter);
          io.to('shelters').emit('shelterUpdate', newShelter);
        }
      }
    }
    
    // Если статус изменился, обновляем занятость приюта
    if (oldPet.status !== status) {
      const shelter = await Shelter.findById(shelter_id || oldPet.shelter_id);
      
      if (shelter) {
        const capacityDelta = getShelterCapacityDelta(oldPet.status, status);

        if (capacityDelta === 1) {
          if (shelter.current_capacity >= shelter.max_capacity) {
            return res.status(400).json({ error: 'Приют заполнен до максимальной вместимости' });
          }
          shelter.current_capacity += 1;
          await shelter.save();
        } else if (capacityDelta === -1) {
          shelter.current_capacity = safeDecrementCapacity(shelter.current_capacity);
          await shelter.save();
        }
        
        // Emit socket event for shelter update
        const io = req.app.get('io');
        if (io) {
          io.emit('shelterUpdate', shelter);
          io.to('shelters').emit('shelterUpdate', shelter);
        }
      }
    }
    
    // If there's a new picture, update filename
    if (req.file) {
      const newFilename = await uploadPetImage(req.file);
      updateData.filename = newFilename;

      if (oldPet.filename) {
        await deletePetImage(oldPet.filename);
      }
    }
    
    // Update pet with new data
    const pet = await Pet.findByIdAndUpdate(id, updateData, { new: true });
    
    // Emit WebSocket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      // Отправляем событие для обновления списков видов и пород, если они изменились
      if (species !== oldPet.species || breed !== oldPet.breed) {
        io.emit('speciesBreedUpdate', { species, breed });
        console.log('WebSocket: Отправлено событие об обновлении видов и пород');
      }
      
      // Отправляем событие для обновления черт характера, если они изменились
      if (updateData.temperamentTraits && Array.isArray(updateData.temperamentTraits)) {
        const oldTraits = oldPet.temperamentTraits || [];
        const newTraits = updateData.temperamentTraits;
        
        // Находим новые черты характера (которых не было раньше)
        newTraits.forEach(trait => {
          if (!oldTraits.includes(trait)) {
            io.emit('temperamentUpdate', { temperament: trait });
            console.log(`WebSocket: Отправлено событие об обновлении черты характера: ${trait}`);
          }
        });
      }
      
      // Проверяем, изменились ли критичные для календаря ухода данные
      const calendarCriticalFields = ['species', 'breed', 'birthDate', 'medicalNotes', 'size', 'energyLevel', 'careLevel', 'activityNeeds'];
      const calendarFieldsChanged = calendarCriticalFields.some(field => {
        const oldValue = oldPet[field];
        const newValue = pet[field];
        
        // Специальная обработка для дат
        if (field === 'birthDate') {
          const oldDate = oldValue ? new Date(oldValue).toISOString().split('T')[0] : null;
          const newDate = newValue ? new Date(newValue).toISOString().split('T')[0] : null;
          return oldDate !== newDate;
        }
        
        return oldValue !== newValue;
      });
      
      if (calendarFieldsChanged) {
        // Отправляем специальное событие для календаря ухода
        io.emit('petCareCalendarUpdate', {
          petId: pet._id,
          pet: pet,
          fieldsChanged: calendarCriticalFields.filter(field => {
            const oldValue = oldPet[field];
            const newValue = pet[field];
            if (field === 'birthDate') {
              const oldDate = oldValue ? new Date(oldValue).toISOString().split('T')[0] : null;
              const newDate = newValue ? new Date(newValue).toISOString().split('T')[0] : null;
              return oldDate !== newDate;
            }
            return oldValue !== newValue;
          })
        });
        console.log('WebSocket: Отправлено событие об обновлении данных для календаря ухода');
      }
      
      io.emit('petRequestUpdate', pet);
    }
    
    res.status(200).json(pet);
  } catch (err) {
    console.error('Error updating pet:', err);
    res.status(500).json({ error: err.message });
  }
};

const getAllSpecies = async (req, res) => {
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
};

const getAllTemperaments = async (req, res) => {
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
};

// Получение питомцев пользователя
const getUserPets = async (req, res) => {
    try {
        const { userId, email } = req.query;
        let query = {};
        
        // Build query based on provided parameters
        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            query.user_id = new mongoose.Types.ObjectId(userId);
        } else if (email) {
            query.email = email;
        } else {
            return res.status(400).json({ message: 'Either userId or email must be provided' });
        }
        
        console.log('Query for user pets:', query); // Add logging
        
        // Находим все питомцы пользователя
        const pets = await Pet.find(query).sort({ createdAt: -1 });
        
        // Получаем информацию о приютах - фильтруем null значения shelter_id
        const shelterIds = [...new Set(pets
            .map(pet => pet.shelter_id)
            .filter(id => id && mongoose.Types.ObjectId.isValid(id))
        )];
        
        const shelters = shelterIds.length > 0 
            ? await Shelter.find({ _id: { $in: shelterIds } })
            : [];
        
        // Создаем объекты с данными о питомце и приюте
        const enrichedPets = pets.map(pet => {
            let shelterDetails = null;
            
            // Только ищем shelter, если у питомца есть shelter_id
            if (pet.shelter_id) {
                shelterDetails = shelters.find(
                    shelter => shelter._id.toString() === pet.shelter_id.toString()
                );
            }
            
            return {
                ...pet.toObject(),
                shelterDetails
            };
        });
        
        console.log('Found pets:', enrichedPets.length); // Add logging
        res.status(200).json(enrichedPets);
    } catch (err) {
        console.error("Error fetching user pets:", err, err.stack);
        res.status(500).json({ message: err.message }); // Changed to 500 for server errors
    }
};

module.exports = {
  postPetRequest,
  approveRequest,
  deletePost,
  allPets,
  getFilteredPets,
  getPetById,
  getApprovedPetById,
  getBreedsForType,
  updatePet,
  getAllSpecies,
  getUserPets
};
