const mongoose = require('mongoose');
const Pet = require('../Model/PetModel');
const User = require('../Model/UserModel');
const ChatHistory = require('../Model/ChatHistoryModel');
const { processChatMessage, getWelcomeMessage, getBreedInfo, clearCache } = require('../services/aiChatService');

/**
 * Получить приветственное сообщение
 */
const getWelcome = async (req, res) => {
    try {
        const userId = req.user?._id?.toString();
        const mode = req.query.mode || 'selection'; // 'selection' или 'qa'
        
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // НЕ архивируем историю здесь: этот эндпоинт вызывается при пустом UI (первая загрузка,
        // сбой GET /history и т.д.) — updateMany снимал isActive с реальной переписки, и она
        // «пропадала». Новый диалог — только через DELETE /ai-chat/history (кнопка в чате).

        const welcome = await getWelcomeMessage(mode);
        
        res.status(200).json({
            message: welcome.response,
            suggestedPets: welcome.suggestedPets,
            conversationId: userId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting welcome message:', error);
        res.status(500).json({ error: 'Failed to start conversation' });
    }
};

/**
 * Отправить сообщение в чат
 */
const sendMessage = async (req, res) => {
    try {
        const userId = req.user?._id?.toString();
        const { message, mode = 'selection' } = req.body; // Добавляем mode

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({ error: 'Message is required' });
        }

        console.log(`💬 Режим чата: ${mode === 'selection' ? '🐕 Подбор питомца' : '💬 Вопросы и ответы'}`);

        // Получаем или создаем историю диалога из БД для конкретного режима
        let chatHistory = await ChatHistory.getOrCreate(userId, mode);

        // Формируем историю для AI (последние 20 сообщений)
        const historyForAI = chatHistory.getRecentMessages(20).map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp
        }));

        // Добавляем текущее сообщение пользователя в историю для AI
        historyForAI.push({
            role: 'user',
            content: message.trim(),
            timestamp: new Date()
        });

        // Получаем доступных питомцев
        const availablePets = await Pet.find({ 
            status: 'Approved',
            user_id: { $ne: userId } // Исключаем питомцев самого пользователя
        }).lean();

        // Обрабатываем сообщение через AI с учетом режима
        const aiResult = await processChatMessage(
            userId,
            message.trim(),
            historyForAI,
            availablePets,
            mode // Передаем режим
        );

        // Логируем результат для отладки
        console.log('📥 Результат от processChatMessage:', {
            hasResponse: !!aiResult.response,
            responseLength: aiResult.response?.length || 0,
            responsePreview: aiResult.response?.substring(0, 100) || 'ПУСТО',
            hasSuggestedPets: !!(aiResult.suggestedPets && aiResult.suggestedPets.length > 0),
            suggestedPetsCount: aiResult.suggestedPets?.length || 0,
            hasContext: !!aiResult.conversationContext
        });

        // Сохраняем сообщение пользователя в БД
        await chatHistory.addMessage('user', message.trim());

        // Сохраняем ответ AI в БД
        const petIds = (aiResult.suggestedPets || []).map(pet => pet._id).filter(Boolean);
        // Проверяем, что response существует и не пустой
        const assistantResponse = (aiResult.response && aiResult.response.trim().length > 0) 
            ? aiResult.response.trim() 
            : (aiResult.message && aiResult.message.trim().length > 0)
                ? aiResult.message.trim()
                : 'Извините, не удалось обработать запрос. Попробуйте переформулировать вопрос.';
        
        console.log(`💾 Сохраняем ответ в БД: "${assistantResponse.substring(0, 50)}..." (${assistantResponse.length} символов)`);
        await chatHistory.addMessage('assistant', assistantResponse, petIds);

        console.log(`✅ История сохранена в БД для пользователя ${userId} (всего ${chatHistory.messageCount} сообщений)`);

        // Ограничиваем количество сообщений (удаляем старые)
        if (chatHistory.messages.length > 100) {
            chatHistory.messages = chatHistory.messages.slice(-100);
            await chatHistory.save();
            console.log(`🧹 Очищена старая история (оставлено 100 последних сообщений)`);
        }

        // Обновляем предпочтения пользователя на основе контекста чата
        if (aiResult.conversationContext && Object.keys(aiResult.conversationContext).length > 0) {
            try {
                await updateUserPreferencesFromContext(userId, aiResult.conversationContext);
                // После обновления предпочтений уведомляем клиента через сокеты
                try {
                    const io = req.app.get('io');
                    if (io) {
                        if (userId) io.to(`userId:${userId}`).emit('userPreferencesUpdated');
                        if (req.user?.email) io.to(`user:${req.user.email}`).emit('userPreferencesUpdated');
                    }
                } catch (emitErr) {
                    console.warn('⚠️ Не удалось отправить событие userPreferencesUpdated:', emitErr.message);
                }
            } catch (prefError) {
                console.error('⚠️ Не удалось обновить предпочтения:', prefError.message);
                // Не критично, продолжаем работу
            }
        }

        // Форматируем питомцев для ответа
        const suggestedPets = (aiResult.suggestedPets || []).map(pet => ({
            _id: pet._id,
            name: pet.name,
            species: pet.species,
            breed: pet.breed,
            age: pet.age,
            size: pet.size,
            energyLevel: pet.energyLevel,
            description: pet.description,
            image: pet.image,
            matchScore: pet.matchScore || 0,
            aiReasoning: pet.aiReasoning || ''  // Добавляем reasoning
        }));

        // Расчет прогресса и подсказки
        const context = aiResult.conversationContext || {};
        const progress = context.progress || 0;
        const progressHint = getProgressHint(progress, context);

        // Используем тот же assistantResponse, который был сохранен в БД
        res.status(200).json({
            message: assistantResponse,  // Используем проверенный ответ вместо aiResult.response
            suggestedPets: suggestedPets,
            hasEnoughInfo: aiResult.hasEnoughInfo || false,
            conversationContext: context,
            progress: progress,              // Добавляем прогресс
            progressHint: progressHint,      // Добавляем подсказку
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error processing chat message:', error);
        console.error('Error details:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({ 
            error: 'Failed to process message',
            message: 'Извините, произошла ошибка. Попробуйте переформулировать вопрос или обратитесь к администратору.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Получить историю диалога
 */
const getHistory = async (req, res) => {
    try {
        const userId = req.user?._id?.toString();
        const mode = req.query.mode || 'selection'; // Получаем режим из query параметра

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Загружаем историю из БД для конкретного режима с populate для питомцев
        const chatHistory = await ChatHistory.findOne({ userId, mode, isActive: true })
            .populate('messages.suggestedPets', 'name species breed filename size energyLevel careLevel activityNeeds description matchScore aiReasoning');

        const messages = chatHistory?.messages || [];

        // Преобразуем сообщения для отправки клиенту
        const formattedMessages = messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
            suggestedPets: msg.suggestedPets || []
        }));

        res.status(200).json({
            history: formattedMessages,
            mode: mode,
            count: formattedMessages.length,
            totalChats: chatHistory?.messageCount || 0
        });
    } catch (error) {
        console.error('Error getting chat history:', error);
        res.status(500).json({ error: 'Failed to get history' });
    }
};

/**
 * Очистить историю диалога
 */
const clearHistory = async (req, res) => {
    try {
        const userId = req.user?._id?.toString();

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Получаем режим из query параметра
        const mode = req.query.mode || 'selection';
        
        // Архивируем текущую активную историю для конкретного режима
        await ChatHistory.updateMany(
            { userId, mode, isActive: true },
            { $set: { isActive: false } }
        );

        console.log(`🗑️ История очищена для пользователя ${userId}`);

        res.status(200).json({ 
            message: 'History cleared',
            success: true
        });
    } catch (error) {
        console.error('Error clearing chat history:', error);
        res.status(500).json({ error: 'Failed to clear history' });
    }
};

/**
 * Получить информацию о породе
 */
const getBreedInformation = async (req, res) => {
    try {
        const { breed, species } = req.query;

        if (!breed) {
            return res.status(400).json({ error: 'Breed name is required' });
        }

        const info = await getBreedInfo(breed, species);

        res.status(200).json({
            breed: breed,
            species: species || 'unknown',
            information: info,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting breed information:', error);
        res.status(500).json({ error: 'Failed to get breed information' });
    }
};

/**
 * Обновление предпочтений пользователя на основе контекста чата
 */
async function updateUserPreferencesFromContext(userId, context) {
    try {
        const user = await User.findById(userId);
        if (!user) {
            console.warn('⚠️ Пользователь не найден:', userId);
            return;
        }

        // Инициализируем preferences если его нет
        if (!user.preferences) {
            user.preferences = {};
        }

        let updated = false;

        // Обновляем виды животных (MERGE, не замена!)
        if (context.preferredSpecies && context.preferredSpecies.length > 0) {
            const existingSpecies = user.preferences.preferredSpecies || [];
            // Добавляем только новые виды
            const newSpecies = context.preferredSpecies.filter(s => !existingSpecies.includes(s));
            
            if (newSpecies.length > 0) {
                user.preferences.preferredSpecies = [...existingSpecies, ...newSpecies];
                updated = true;
                console.log('✅ Добавлены виды животных:', newSpecies);
                console.log('📋 Текущие виды:', user.preferences.preferredSpecies);
            }
        }

        // Обновляем породы (MERGE)
        if (context.preferredBreeds && context.preferredBreeds.length > 0) {
            const existingBreeds = user.preferences.preferredBreeds || [];
            const newBreeds = context.preferredBreeds.filter(b => !existingBreeds.includes(b));
            
            if (newBreeds.length > 0) {
                user.preferences.preferredBreeds = [...existingBreeds, ...newBreeds];
                updated = true;
                console.log('✅ Добавлены породы:', newBreeds);
                console.log('📋 Текущие породы:', user.preferences.preferredBreeds);
            }
        }

        // Обновляем размеры (MERGE)
        if (context.preferredSizes && context.preferredSizes.length > 0) {
            const existingSizes = user.preferences.preferredSizes || [];
            const newSizes = context.preferredSizes.filter(s => !existingSizes.includes(s));
            
            if (newSizes.length > 0) {
                user.preferences.preferredSizes = [...existingSizes, ...newSizes];
                updated = true;
            }
        }

        // Обновляем уровень энергии
        if (context.energyLevel) {
            user.preferences.energyLevel = context.energyLevel;
            updated = true;
        }

        // Обновляем потребность в активности
        if (context.activityNeeds) {
            user.preferences.activityNeeds = context.activityNeeds;
            updated = true;
        }

        // Обновляем сложность ухода
        if (context.careLevel) {
            user.preferences.careLevel = context.careLevel;
            updated = true;
        }

        // Обновляем темперамент (MERGE)
        if (context.preferredTemperaments && context.preferredTemperaments.length > 0) {
            const existingTemperaments = user.preferences.preferredTemperaments || [];
            const newTemperaments = context.preferredTemperaments.filter(t => !existingTemperaments.includes(t));
            
            if (newTemperaments.length > 0) {
                user.preferences.preferredTemperaments = [...existingTemperaments, ...newTemperaments];
                updated = true;
            }
        }

        // Обновляем информацию о детях
        if (context.hasKids !== null && context.hasKids !== undefined) {
            user.preferences.hasKids = context.hasKids;
            updated = true;
        }

        // Обновляем информацию о других животных
        if (context.hasOtherPets !== null && context.hasOtherPets !== undefined) {
            user.preferences.hasOtherPets = context.hasOtherPets;
            updated = true;
        }

        // Обновляем информацию о жилье
        if (context.livingSpace) {
            user.preferences.livingSpace = context.livingSpace;
            updated = true;
        }

        // Обновляем информацию об аллергиях
        if (context.allergyFriendly !== null && context.allergyFriendly !== undefined) {
            user.preferences.allergyFriendly = context.allergyFriendly;
            updated = true;
        }

        // Обновляем предпочтения по городам (MERGE, только валидные города)
        if (context.preferredCities && context.preferredCities.length > 0) {
            const existingCities = user.preferences.preferredCities || [];
            const validCities = context.preferredCities.filter(city => 
                city.length > 3 && /^[А-ЯЁ][а-яё]+(-[А-ЯЁ][а-яё]+)?$/.test(city)
            );
            const newCities = validCities.filter(c => !existingCities.includes(c));
            
            if (newCities.length > 0) {
                user.preferences.preferredCities = [...existingCities, ...newCities];
                updated = true;
                console.log('✅ Добавлены города:', newCities);
                console.log('📋 Текущие города:', user.preferences.preferredCities);
            }
        }

        // Обновляем предпочтения по возрасту
        if (context.preferredAgeRange) {
            user.preferences.preferredAgeRange = context.preferredAgeRange;
            updated = true;
        }

        // Сохраняем если были изменения
        if (updated) {
            await user.save();
            console.log('✅ Предпочтения пользователя обновлены из чата');
            console.log('📋 Сохраненные предпочтения:', {
                species: user.preferences.preferredSpecies,
                breeds: user.preferences.preferredBreeds,
                cities: user.preferences.preferredCities,
                ageRange: user.preferences.preferredAgeRange,
                sizes: user.preferences.preferredSizes,
                energyLevel: user.preferences.energyLevel,
                activityNeeds: user.preferences.activityNeeds,
                careLevel: user.preferences.careLevel,
                temperaments: user.preferences.preferredTemperaments
            });
        }
    } catch (error) {
        console.error('❌ Ошибка обновления предпочтений:', error.message);
        throw error;
    }
}

/**
 * Очистка старых историй (вызывается периодически)
 */
const cleanupOldHistories = async () => {
    try {
        // Архивируем истории старше 30 дней
        const archivedCount = await ChatHistory.archiveOldHistories(30);
        
        if (archivedCount > 0) {
            console.log(`🧹 Автоматически архивировано ${archivedCount} старых историй (>30 дней)`);
        }
    } catch (error) {
        console.error('❌ Ошибка при очистке старых историй:', error);
    }
};

// Запускаем очистку каждые 24 часа
setInterval(cleanupOldHistories, 24 * 60 * 60 * 1000);

// Запускаем очистку при старте сервера (через 1 минуту)
setTimeout(cleanupOldHistories, 60 * 1000);

/**
 * Получить подсказку для пользователя на основе прогресса
 */
function getProgressHint(progress, context) {
    if (progress < 25) {
        return "Расскажите, какого питомца ищете";
    } else if (progress < 50) {
        return "Отлично! Расскажите про условия содержания";
    } else if (progress < 80) {
        return "Почти готово! Уточните образ жизни";
    } else {
        return "Скоро покажу рекомендации!";
    }
}

/**
 * Очистить кэш AI-чата (для принудительного обновления данных из БД)
 */
const clearAICache = async (req, res) => {
    try {
        clearCache();
        res.json({ 
            success: true, 
            message: 'Кэш AI-чата успешно очищен. Данные будут загружены заново при следующем запросе.' 
        });
    } catch (error) {
        console.error('❌ Ошибка очистки кэша:', error);
        res.status(500).json({ error: 'Failed to clear cache' });
    }
};

module.exports = {
    getWelcome,
    sendMessage,
    getHistory,
    clearHistory,
    getBreedInformation,
    clearAICache
};

