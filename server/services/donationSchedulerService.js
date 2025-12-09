const Shelter = require('../Model/ShelterModel');

/**
 * Проверяет, является ли сегодня последний день месяца
 */
function isLastDayOfMonth() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Если завтра первый день следующего месяца, значит сегодня последний день текущего месяца
    return tomorrow.getDate() === 1;
}

/**
 * Получает строку с датой для проверки, был ли уже сброс сегодня
 */
function getTodayDateString() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

/**
 * Автоматически сбрасывает цели сбора средств для всех приютов в последний день месяца
 */
async function resetAllShelterDonationGoals() {
    try {
        const todayDateString = getTodayDateString();
        console.log(`🔄 Проверка необходимости сброса целей сбора средств (${todayDateString})...`);
        
        if (!isLastDayOfMonth()) {
            console.log('📅 Сегодня не последний день месяца, сброс не требуется');
            return null;
        }
        
        // Находим все приюты с установленной целью
        const sheltersWithGoals = await Shelter.find({ 
            donationGoal: { $gt: 0 } 
        });
        
        if (sheltersWithGoals.length === 0) {
            console.log('✅ Нет приютов с установленными целями для сброса');
            return null;
        }
        
        console.log(`🔄 Найдено ${sheltersWithGoals.length} приютов с целями. Начинаю автоматический сброс...`);
        
        // Сбрасываем цели для всех приютов
        const updateResult = await Shelter.updateMany(
            { donationGoal: { $gt: 0 } },
            { 
                $set: { 
                    donationGoal: 0,
                    donationDescription: ''
                } 
            }
        );
        
        console.log(`✅ Автоматически сброшены цели для ${updateResult.modifiedCount} приютов в последний день месяца`);
        
        // Возвращаем список ID приютов для отправки WebSocket событий
        return sheltersWithGoals.map(shelter => shelter._id.toString());
        
    } catch (error) {
        console.error('❌ Ошибка при автоматическом сбросе целей приютов:', error);
        throw error;
    }
}

/**
 * Инициализирует планировщик для автоматического сброса целей
 * Проверяет каждый день в полночь (00:00), является ли сегодня последний день месяца
 */
function initializeDonationGoalScheduler(io) {
    console.log('⏰ Инициализация планировщика автоматического сброса целей сбора средств...');
    
    // Переменная для отслеживания последнего дня, когда был выполнен сброс
    let lastResetDate = null;
    
    // Функция для проверки и сброса целей
    const checkAndResetGoals = async () => {
        try {
            const todayDateString = getTodayDateString();
            
            // Проверяем, не был ли уже выполнен сброс сегодня
            if (lastResetDate === todayDateString) {
                console.log(`⏭️ Сброс целей уже был выполнен сегодня (${todayDateString}), пропускаем`);
                return;
            }
            
            const shelterIds = await resetAllShelterDonationGoals();
            
            // Если сброс был выполнен, сохраняем дату
            if (shelterIds && shelterIds.length > 0) {
                lastResetDate = todayDateString;
                
                // Отправляем WebSocket события для обновления клиентов
                if (io) {
                    shelterIds.forEach(shelterId => {
                        io.emit('donationGoalReset', { shelter_id: shelterId });
                        io.to('shelters').emit('donationGoalReset', { shelter_id: shelterId });
                    });
                    console.log(`📡 Отправлено ${shelterIds.length} WebSocket событий о сбросе целей`);
                }
            }
        } catch (error) {
            console.error('❌ Ошибка в планировщике сброса целей:', error);
        }
    };
    
    // Вычисляем время до следующей полночи
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0); // Следующая полночь
    const msUntilMidnight = midnight.getTime() - now.getTime();
    
    // Запускаем первую проверку через время до полуночи
    setTimeout(() => {
        checkAndResetGoals();
        
        // Затем проверяем каждые 24 часа (в полночь)
        setInterval(checkAndResetGoals, 24 * 60 * 60 * 1000);
        
        console.log('✅ Планировщик автоматического сброса целей запущен. Проверка каждый день в полночь (00:00).');
    }, msUntilMidnight);
    
    // Также проверяем при старте сервера (на случай, если сервер перезапустился в последний день месяца)
    // Но только если еще не прошла полночь сегодня
    const currentHour = now.getHours();
    if (currentHour >= 0) {
        checkAndResetGoals();
    }
}

module.exports = {
    resetAllShelterDonationGoals,
    initializeDonationGoalScheduler,
    isLastDayOfMonth
};

