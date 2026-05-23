/**
 * AI Chat Service для интерактивных рекомендаций по питомцам
 * Использует Google Gemini для естественного диалога
 */

const { GoogleGenAI } = require('@google/genai');
const Pet = require('../Model/PetModel');
const Shelter = require('../Model/ShelterModel');
const { getAIRecommendations } = require('./aiRecommendationService');

// Инициализация Gemini AI
const genAI = process.env.GEMINI_API_KEY 
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

// Кэш для динамических данных из БД (обновляется каждые 30 секунд для актуальности)
let breedsCache = null;
let citiesCache = null;
let energyLevelsCache = null;
let temperamentsCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30 * 1000; // 30 секунд (быстрое обновление для отражения изменений из админки)

/** Кэш группировки пород по видам для system prompt (без Pet.find на каждое сообщение) */
let breedsBySpeciesPromptCache = null; // { speciesKey, breedsBySpecies }
let breedsBySpeciesPromptCacheAt = 0;
const PROMPT_BREEDS_TTL = 60 * 1000;

/**
 * Очистить кэш (для принудительного обновления данных)
 */
function clearCache() {
  breedsCache = null;
  citiesCache = null;
  energyLevelsCache = null;
  temperamentsCache = null;
  cacheTimestamp = 0;
  breedsBySpeciesPromptCache = null;
  breedsBySpeciesPromptCacheAt = 0;
  console.log('🧹 Кэш AI-чата очищен');
}

/**
 * Получить уникальные породы из БД
 */
async function getUniqueBreedsFromDB() {
  const now = Date.now();
  if (breedsCache && (now - cacheTimestamp) < CACHE_TTL) {
    return breedsCache;
  }

  try {
    const breeds = await Pet.distinct('breed');
    breedsCache = breeds.filter(b => b && b.trim().length > 0);
    cacheTimestamp = now;
    console.log('📚 Загружено пород из БД:', breedsCache.length);
    console.log('   Список пород:', breedsCache.join(', '));
    return breedsCache;
  } catch (error) {
    console.error('⚠️ Ошибка загрузки пород из БД:', error.message);
    return breedsCache || [];
  }
}

/**
 * Получить уникальные города из БД (из приютов, а не из животных)
 */
async function getUniqueCitiesFromDB() {
  const now = Date.now();
  if (citiesCache && (now - cacheTimestamp) < CACHE_TTL) {
    return citiesCache;
  }

  try {
    // Берем города из приютов, а не из животных
    const cities = await Shelter.distinct('city');
    citiesCache = cities.filter(c => c && c.trim().length > 2);
    cacheTimestamp = now; // Обновляем timestamp при каждой загрузке
    console.log('🏙️ Загружено городов из приютов:', citiesCache.length, '| Список:', citiesCache.join(', '));
    return citiesCache;
  } catch (error) {
    console.error('⚠️ Ошибка загрузки городов из БД:', error.message);
    return citiesCache || [];
  }
}

/**
 * Получить уникальные уровни энергии из БД
 */
async function getUniqueEnergyLevelsFromDB() {
  const now = Date.now();
  if (energyLevelsCache && (now - cacheTimestamp) < CACHE_TTL) {
    return energyLevelsCache;
  }

  try {
    const energyLevels = await Pet.distinct('energyLevel');
    energyLevelsCache = energyLevels.filter(e => e && e.trim().length > 0);
    cacheTimestamp = now; // Обновляем timestamp при каждой загрузке
    console.log('⚡ Загружено уровней энергии из БД:', energyLevelsCache.length);
    return energyLevelsCache;
  } catch (error) {
    console.error('⚠️ Ошибка загрузки уровней энергии из БД:', error.message);
    return energyLevelsCache || ['low', 'medium', 'high'];
  }
}

/**
 * Получить уникальные виды животных из БД
 */
async function getUniqueSpeciesFromDB() {
  const now = Date.now();
  // Используем общий кэш timestamp для всех данных
  if (citiesCache && (now - cacheTimestamp) < CACHE_TTL) {
    // Если кэш актуален, загружаем виды
    try {
      const species = await Pet.distinct('species');
      const filteredSpecies = species.filter(s => s && s.trim().length > 0);
      console.log('🦁 Загружено видов животных из БД:', filteredSpecies.length);
      console.log('   Список видов:', filteredSpecies.join(', '));
      return filteredSpecies;
    } catch (error) {
      console.error('⚠️ Ошибка загрузки видов из БД:', error.message);
      return ['Собака', 'Кошка', 'Птица', 'Кролик'];
    }
  }
  
  // Если кэш устарел, загружаем заново
  try {
    const species = await Pet.distinct('species');
    const filteredSpecies = species.filter(s => s && s.trim().length > 0);
    console.log('🦁 Загружено видов животных из БД:', filteredSpecies.length);
    console.log('   Список видов:', filteredSpecies.join(', '));
    return filteredSpecies;
  } catch (error) {
    console.error('⚠️ Ошибка загрузки видов из БД:', error.message);
    return ['Собака', 'Кошка', 'Птица', 'Кролик'];
  }
}

/**
 * Получить уникальные темпераменты из БД
 */
async function getUniqueTemperamentsFromDB() {
  const now = Date.now();
  if (temperamentsCache && (now - cacheTimestamp) < CACHE_TTL) {
    return temperamentsCache;
  }

  try {
    // temperamentTraits - это массив, нужно получить все уникальные значения
    const pets = await Pet.find({}, 'temperamentTraits').lean();
    const allTemperaments = new Set();
    pets.forEach(pet => {
      if (pet.temperamentTraits && Array.isArray(pet.temperamentTraits)) {
        pet.temperamentTraits.forEach(trait => {
          if (trait && trait.trim().length > 0) {
            allTemperaments.add(trait.trim());
          }
        });
      }
    });
    temperamentsCache = Array.from(allTemperaments);
    cacheTimestamp = now; // Обновляем timestamp при каждой загрузке
    console.log('🎭 Загружено темпераментов из БД:', temperamentsCache.length);
    return temperamentsCache;
  } catch (error) {
    console.error('⚠️ Ошибка загрузки темпераментов из БД:', error.message);
    return temperamentsCache || ['friendly', 'playful', 'calm', 'energetic', 'independent'];
  }
}

/**
 * Системный промпт для AI ассистента (будет дополнен динамическими данными)
 */
async function buildSystemPrompt(availableBreeds = [], availableCities = [], availableEnergyLevels = [], availableTemperaments = []) {
  // Загружаем реальные виды животных из БД
  const availableSpecies = await getUniqueSpeciesFromDB();
  
  // Формируем список видов с правильными падежами
  const speciesMap = {
    'Собака': 'собаку',
    'Кошка': 'кошку',
    'Птица': 'птицу',
    'Кролик': 'кролика',
    'Грызун': 'грызуна',
    'Хомяк': 'хомяка',
    'Шиншилла': 'шиншиллу',
    'Морская свинка': 'морскую свинку'
  };
  
  const speciesList = availableSpecies
    .map(s => speciesMap[s] || s.toLowerCase())
    .join(', ') || 'собаку, кошку, птицу, кролика';
  
  // Группируем породы по видам (кэш ~60 с — не сканируем всех питомцев на каждое сообщение)
  const speciesKey = availableSpecies.slice().sort().join('|');
  const nowBreed = Date.now();
  let breedsBySpecies;
  if (
    breedsBySpeciesPromptCache &&
    breedsBySpeciesPromptCache.speciesKey === speciesKey &&
    nowBreed - breedsBySpeciesPromptCacheAt < PROMPT_BREEDS_TTL
  ) {
    breedsBySpecies = breedsBySpeciesPromptCache.breedsBySpecies;
  } else {
    breedsBySpecies = {};
    availableSpecies.forEach(species => {
      breedsBySpecies[species] = [];
    });
    try {
      const pets = await Pet.find({}, 'species breed').lean();
      pets.forEach(pet => {
        if (pet.species && pet.breed && breedsBySpecies[pet.species]) {
          if (!breedsBySpecies[pet.species].includes(pet.breed)) {
            breedsBySpecies[pet.species].push(pet.breed);
          }
        }
      });
    } catch (error) {
      console.error('⚠️ Ошибка группировки пород по видам:', error.message);
    }
    breedsBySpeciesPromptCache = { speciesKey, breedsBySpecies };
    breedsBySpeciesPromptCacheAt = nowBreed;
  }
  // Показываем ВСЕ города из БД
  const citiesList = availableCities.length > 0 ? availableCities.join(', ') : 'Минск, Гомель, Брест, Витебск, Гродно, Могилев';
  
  // Формируем ПОЛНЫЕ списки пород для каждого вида (все породы из БД)
  const dogBreeds = (breedsBySpecies['Собака'] || []).length > 0 
    ? breedsBySpecies['Собака'].join(', ') 
    : 'Лабрадор, Немецкая овчарка, Дворняжка';
  const catBreeds = (breedsBySpecies['Кошка'] || []).length > 0 
    ? breedsBySpecies['Кошка'].join(', ') 
    : 'Мейн-кун, Сибирская, Русская голубая';
  const birdBreeds = (breedsBySpecies['Птица'] || []).length > 0 
    ? breedsBySpecies['Птица'].join(', ') 
    : 'Волнистый попугай, Жако, Неразлучник';
  const rabbitBreeds = (breedsBySpecies['Кролик'] || []).length > 0 
    ? breedsBySpecies['Кролик'].join(', ') 
    : 'Декоративный кролик';
  const rodentBreeds = (breedsBySpecies['Грызун'] || []).length > 0 
    ? breedsBySpecies['Грызун'].join(', ') 
    : 'Хомяк, Шиншилла, Морская свинка';
  
  // Переводим уровни энергии на русский
  const translateEnergy = (level) => {
    const map = { 'low': 'низкий', 'medium': 'средний', 'high': 'высокий' };
    return map[level] || level;
  };
  const energyList = availableEnergyLevels.length > 0 
    ? availableEnergyLevels.map(translateEnergy).join(', ')
    : 'низкий, средний, высокий';
  
  // Показываем ВСЕ темпераменты из БД (на русском)
  const temperamentsList = availableTemperaments.length > 0
    ? availableTemperaments.join(', ')
    : 'дружелюбный, игривый, спокойный, ласковый, независимый, энергичный, умный, верный, добрый, преданный';

  // Логируем количество данных для отладки
  console.log(`📊 Данные для AI-промпта: Виды: ${availableSpecies.length}, Города: ${availableCities.length}, Породы собак: ${(breedsBySpecies['Собака'] || []).length}, Породы кошек: ${(breedsBySpecies['Кошка'] || []).length}, Темпераменты: ${availableTemperaments.length}`);

  return `Ты - дружелюбный эксперт-консультант по подбору домашних животных из приюта.

СТИЛЬ ОБЩЕНИЯ:
- Дружелюбный, теплый, но профессиональный
- Средние ответы (4-6 предложений)
- Задавай ТОЛЬКО 1 вопрос за раз
- Используй эмодзи умеренно 🐕🐈
- Пиши на русском языке
- ВСЕГДА предлагай конкретные варианты из доступных данных

ДОСТУПНЫЕ ДАННЫЕ ИЗ БД:
📍 Города: ${citiesList}
🐕 Породы собак: ${dogBreeds}
🐈 Породы кошек: ${catBreeds}
🦜 Породы птиц: ${birdBreeds}
🐰 Породы кроликов: ${rabbitBreeds}
🐹 Породы грызунов: ${rodentBreeds}
⚡ Уровни энергии: ${energyList}
🎭 Темпераменты: ${temperamentsList}

СТРОГАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ ВОПРОСОВ (задавай ТОЛЬКО то, чего НЕ хватает):

1️⃣ ВИД → "Какое животное ищешь: ${speciesList}?"

2️⃣ ПОРОДА (ОБЯЗАТЕЛЬНО после вида!) → 
   - Для собак: "Какая порода интересует? Доступны: ${dogBreeds}. Или любая?"
   - Для кошек: "Какая порода интересует? Доступны: ${catBreeds}. Или любая?"
   - Для птиц: "Какая порода интересует? Доступны: ${birdBreeds}. Или любая?"
   - Для кроликов: "Какая порода интересует? Доступны: ${rabbitBreeds}. Или любая?"
   - Для грызунов: "Какая порода интересует? Доступны: ${rodentBreeds}. Или любая?"
   ВАЖНО: ВСЕГДА показывай ВСЕ доступные породы из списка выше, НЕ сокращай список!

3️⃣ ГОРОД → "В каком городе хочешь найти питомца? Доступны: ${citiesList}"

4️⃣ РАЗМЕР → "Какой размер предпочитаешь: маленький, средний или большой?"

5️⃣ ВОЗРАСТ → "Какого возраста животное хочешь: молодое, взрослое или пожилое? 🐕" (можно несколько через запятую)

6️⃣ ЭНЕРГИЯ → "Какой уровень энергии предпочитаешь: ${energyList}? 🐕" (можно несколько через запятую)

7️⃣ ТЕМПЕРАМЕНТ → "Какие качества важны? Доступны: ${temperamentsList} 🐈" (можно несколько через запятую, покажи ВСЕ варианты)

8️⃣ ДЕТИ → "Есть ли у тебя дети? 🐕"

9️⃣ ЖИВОТНЫЕ → "Есть ли у тебя другие домашние животные?"

🔟 АЛЛЕРГИИ → "Есть ли аллергия на шерсть? 🐕"

1️⃣1️⃣ ЖИЛЬЕ → "Где живешь: в квартире или в доме? 🐕"

ПРАВИЛА:
✅ Задавай вопросы СТРОГО ПО ПОРЯДКУ (1→2→3→4→5→6→7→8→9→10→11)
✅ НЕ перепрыгивай через вопросы - ОСОБЕННО НЕ ПРОПУСКАЙ ВОПРОС О ПОРОДЕ (#2)!
✅ Если ответ уже дан → переходи к следующему
✅ ВСЕГДА предлагай конкретные варианты из доступных данных (города, породы)
✅ После сбора 5+ параметров → начинай показывать рекомендации
✅ НЕ задавай лишних уточнений
✅ Для вопросов 5, 6, 7 пользователь может указать НЕСКОЛЬКО значений через запятую
✅ ПОРОДА (вопрос #2) - ОБЯЗАТЕЛЬНЫЙ вопрос после того, как узнал вид животного!
✅ КРИТИЧЕСКИ ВАЖНО: Когда показываешь породы, города или темпераменты - ПОКАЗЫВАЙ ВСЕ из списка "ДОСТУПНЫЕ ДАННЫЕ ИЗ БД", НЕ сокращай!

ПРИМЕРЫ:

User: "Хочу кошку"
AI: "Какая порода интересует? Доступны: ${catBreeds}. Или любая?" ✅ (вопрос 2 - ПОРОДА! Показаны ВСЕ породы кошек)

User: "Любая порода"
AI: "В каком городе ищешь? Доступны: ${citiesList}" ✅ (вопрос 3 - ГОРОД, показаны ВСЕ города)

User: "Ищу собаку"
AI: "Какая порода интересует? Доступны: ${dogBreeds}. Или любая?" ✅ (вопрос 2 - ПОРОДА! Показаны ВСЕ породы собак из БД)

User: "У меня дети"
AI: "Есть ли другие животные?" ✅ (вопрос 9)

КРИТИЧЕСКИ ВАЖНО:
❌ НЕПРАВИЛЬНО: User: "Хочу собаку" → AI: "В каком городе?" (пропущен вопрос о породе!)
✅ ПРАВИЛЬНО: User: "Хочу собаку" → AI: "Какая порода интересует? Например: ${dogBreeds}. Или любая?"`;
}

/**
 * Обработка сообщения в режиме Q&A (вопросы и ответы)
 */
async function processQAMessage(userId, message, conversationHistory, availablePets, dbData) {
  const { availableBreeds, availableCities, availableEnergyLevels, availableTemperaments } = dbData;
  
  // Группируем животных по видам и городам для лучшего обзора
  const petsBySpecies = {};
  const petsByCity = {};
  
  availablePets.forEach(pet => {
    const species = pet.species || 'другое';
    const city = pet.area || 'неизвестно';
    
    if (!petsBySpecies[species]) petsBySpecies[species] = [];
    if (!petsByCity[city]) petsByCity[city] = [];
    
    petsBySpecies[species].push(pet);
    petsByCity[city].push(pet);
  });
  
  // Формируем краткую сводку о доступных животных
  const petsSummary = Object.entries(petsBySpecies).map(([species, pets]) => {
    const count = pets.length;
    const cities = [...new Set(pets.map(p => p.area))].filter(Boolean);
    const breeds = [...new Set(pets.slice(0, 5).map(p => p.breed))].filter(Boolean);
    return `${species}: ${count} шт. (${cities.join(', ')}) - породы: ${breeds.join(', ')}`;
  }).join('\n');
  
  // Формируем системный промпт для режима Q&A
  const qaSystemPrompt = `Ты - эксперт-консультант по животным из приютов.

ТВОЯ РОЛЬ:
- Отвечай на вопросы о животных, породах, уходе, приютах
- Используй РЕАЛЬНЫЕ данные из базы данных приютов
- Давай полезные советы и рекомендации
- Если есть подходящие животные в приюте - ОБЯЗАТЕЛЬНО предлагай их

РЕАЛЬНЫЕ ДАННЫЕ ИЗ ПРИЮТОВ (всего ${availablePets.length} животных):
${petsSummary}

ДОСТУПНЫЕ ДАННЫЕ:
📍 Города с приютами: ${availableCities.join(', ')}
🐕 Породы собак: ${availableBreeds.filter(b => b.toLowerCase().includes('терьер') || b.toLowerCase().includes('овчарка') || b.toLowerCase().includes('бульдог') || b.toLowerCase().includes('лабрадор')).slice(0, 10).join(', ')}
🐈 Породы кошек: ${availableBreeds.filter(b => b.toLowerCase().includes('кошка') || b.toLowerCase().includes('кот')).slice(0, 10).join(', ')}
🐰 Другие животные: ${availableBreeds.filter(b => b.toLowerCase().includes('кролик') || b.toLowerCase().includes('птиц') || b.toLowerCase().includes('попугай')).join(', ')}
⚡ Уровни энергии: ${availableEnergyLevels.join(', ')}
🎭 Темпераменты: ${availableTemperaments.slice(0, 10).join(', ')}

СТИЛЬ ОТВЕТОВ:
- Дружелюбный и информативный
- Конкретный и по делу
- Используй эмодзи умеренно
- Если знаешь животных из приюта - предлагай их
- Если не знаешь точного ответа - так и скажи

ФОРМАТ ОТВЕТА:
1. Прямой ответ на вопрос
2. Дополнительная полезная информация
3. Если есть подходящие животные - предложи их (укажи имя, породу, город)

ПРИМЕРЫ:

User: "Какая порода подойдет тихому человеку?"
AI: "Для тихого человека отлично подойдут спокойные породы:

🐈 Кошки: Русская голубая, Британская короткошерстная - независимые и спокойные
🐕 Собаки: Бассет-хаунд, Ши-тцу - уравновешенные и не требуют много активности

В наших приютах есть несколько спокойных питомцев!"

User: "Какие кролики есть в приюте?"
AI: "В наших приютах сейчас есть кролики! [здесь ты должен указать РЕАЛЬНЫХ кроликов из базы данных]
Также расскажу об уходе за кроликами: [полезная информация]"

User: "Какие животные есть в Минске?"
AI: "В приютах Минска сейчас ищут дом [указать РЕАЛЬНОЕ количество и виды из базы]"

КРИТИЧЕСКИ ВАЖНО:
- ВСЕГДА используй РЕАЛЬНЫЕ данные из базы (смотри раздел "РЕАЛЬНЫЕ ДАННЫЕ ИЗ ПРИЮТОВ")
- Если в базе есть животные определенного вида - ОБЯЗАТЕЛЬНО упоминай их
- НЕ говори "информация отсутствует", если в базе есть данные
- Всегда отвечай на русском
- Будь полезным и конкретным`;

  try {
    // Формируем полный промпт с историей
    let fullPrompt = qaSystemPrompt + '\n\n---\n\n';
    
    // Добавляем историю диалога
    conversationHistory.forEach(msg => {
      if (msg.role === 'user') {
        fullPrompt += `User: ${msg.content}\n\n`;
      } else {
        fullPrompt += `AI: ${msg.content}\n\n`;
      }
    });
    
    // Добавляем текущий вопрос
    fullPrompt += `User: ${message}\n\nAI:`;
    
    // Используем API @google/genai с fallback на более легкую модель
    let response;
    let useFallbackModel = false;
    
    try {
    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fullPrompt,
      config: {
        temperature: 0.8,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048, // Увеличено для длинных списков пород/городов/темпераментов
      }
    });
      response = result.text || result.response?.text() || 'Извините, не смог сформировать ответ.';
    } catch (error) {
      // Если модель перегружена, используем более легкую
      if (error.status === 'UNAVAILABLE' || error.code === 503 || error.error?.code === 503) {
        console.log('⚠️ Модель gemini-2.5-flash перегружена при извлечении предпочтений (fallback логика)...');
        try {
          const fallbackResult = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: fullPrompt,
            config: {
              temperature: 0.8,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 4096, // Увеличено для полных ответов
            }
          });
          response = fallbackResult.text || fallbackResult.response?.text() || 'Извините, не смог сформировать ответ.';
        } catch (fallbackError) {
          throw error; // Пробрасываем исходную ошибку
        }
      } else {
        throw error;
      }
    }
    
    // Пытаемся найти подходящих животных на основе вопроса
    const suggestedPets = findRelevantPetsForQuestion(message, availablePets);
    
    return {
      response: response,
      suggestedPets: suggestedPets,
      conversationContext: {},
      hasEnoughInfo: false,
      progress: 0
    };
    
  } catch (error) {
    console.error('❌ Ошибка в режиме Q&A:', error);
    return {
      response: "Извините, произошла ошибка при обработке вашего вопроса. Попробуйте переформулировать или задать другой вопрос.",
      suggestedPets: [],
      conversationContext: {},
      hasEnoughInfo: false
    };
  }
}

/**
 * Поиск релевантных животных для вопроса в режиме Q&A
 */
function findRelevantPetsForQuestion(question, availablePets) {
  const questionLower = question.toLowerCase();
  let relevantPets = [];
  
  // Получаем уникальные виды из доступных животных (динамически!)
  const uniqueSpecies = [...new Set(availablePets.map(pet => pet.species).filter(Boolean))];
  
  // Ищем упоминания видов животных - проверяем каждый вид из БД
  const mentionedSpecies = [];
  uniqueSpecies.forEach(species => {
    const speciesLower = species.toLowerCase();
    
    // Проверяем точное совпадение или частичное
    if (questionLower.includes(speciesLower)) {
      mentionedSpecies.push(species);
    }
    
    // Дополнительные синонимы для популярных видов
    const synonyms = {
      'собака': ['собак', 'пес', 'щен', 'dog'],
      'кошка': ['кошк', 'кот', 'котен', 'cat'],
      'кролик': ['кролик', 'заяц', 'rabbit'],
      'птица': ['птиц', 'попугай', 'bird'],
      'хомяк': ['хомяк', 'хомячок', 'hamster'],
      'черепаха': ['черепах', 'turtle'],
      'рыбка': ['рыб', 'fish'],
      'морская свинка': ['свинк', 'guinea']
    };
    
    // Проверяем синонимы
    const speciesSynonyms = synonyms[speciesLower] || [];
    if (speciesSynonyms.some(syn => questionLower.includes(syn))) {
      if (!mentionedSpecies.includes(species)) {
        mentionedSpecies.push(species);
      }
    }
  });
  
  // Ищем упоминания пород
  const mentionedBreeds = [];
  availablePets.forEach(pet => {
    if (pet.breed && questionLower.includes(pet.breed.toLowerCase())) {
      mentionedBreeds.push(pet.breed);
    }
  });
  
  // Ищем упоминания городов
  const mentionedCities = [];
  availablePets.forEach(pet => {
    if (pet.area && questionLower.includes(pet.area.toLowerCase())) {
      mentionedCities.push(pet.area);
    }
  });
  
  // Ищем упоминания характеристик
  const keywords = {
    'спокойн': (pet) => pet.energyLevel === 'low' || (pet.temperamentTraits && pet.temperamentTraits.includes('спокойный')),
    'активн': (pet) => pet.energyLevel === 'high' || (pet.temperamentTraits && pet.temperamentTraits.includes('энергичный')),
    'игрив': (pet) => pet.temperamentTraits && pet.temperamentTraits.includes('игривый'),
    'дружелюбн': (pet) => pet.temperamentTraits && pet.temperamentTraits.includes('дружелюбный'),
    'для детей': (pet) => pet.isKidFriendly === true,
    'для семьи': (pet) => pet.isKidFriendly === true,
    'квартир': (pet) => pet.size === 'small' || pet.size === 'medium',
    'маленьк': (pet) => pet.size === 'small',
    'больш': (pet) => pet.size === 'large' || pet.size === 'giant'
  };
  
  // Приоритет 1: Упоминания породы
  if (mentionedBreeds.length > 0) {
    relevantPets = availablePets.filter(pet => mentionedBreeds.includes(pet.breed));
  }
  // Приоритет 2: Упоминания вида животного
  else if (mentionedSpecies.length > 0) {
    relevantPets = availablePets.filter(pet => 
      mentionedSpecies.some(species => 
        pet.species && pet.species.toLowerCase().includes(species.toLowerCase())
      )
    );
  }
  // Приоритет 3: Упоминания города
  else if (mentionedCities.length > 0) {
    relevantPets = availablePets.filter(pet => mentionedCities.includes(pet.area));
  }
  // Приоритет 4: Характеристики
  else {
    for (const [keyword, filter] of Object.entries(keywords)) {
      if (questionLower.includes(keyword)) {
        relevantPets = availablePets.filter(filter);
        break;
      }
    }
  }
  
  console.log(`🔍 Найдено релевантных животных для вопроса: ${relevantPets.length}`);
  
  // Возвращаем топ-6 питомцев
  return relevantPets.slice(0, 6).map(pet => ({
    ...pet,
    matchScore: 85,
    aiReasoning: 'Подходит под ваш запрос'
  }));
}

/**
 * Обработка сообщения от пользователя
 */
async function processChatMessage(userId, message, conversationHistory = [], availablePets = [], mode = 'selection') {
  console.log('💬 Обработка сообщения:', message);
  console.log('📜 История диалога:', conversationHistory.length, 'сообщений');
  console.log('🎯 Режим:', mode === 'selection' ? 'Подбор питомца' : 'Вопросы и ответы');
  
  // Если нет API ключа, возвращаем базовый ответ
  if (!genAI) {
    console.warn('⚠️ GEMINI_API_KEY не установлен. AI-помощник недоступен.');
    return {
      response: "AI-помощник пока не настроен.\n\nДля его активации администратору нужно:\n1. Получить API ключ на https://makersuite.google.com/app/apikey\n2. Добавить GEMINI_API_KEY в файл .env\n3. Перезапустить сервер\n\nА пока вы можете использовать фильтры для поиска питомцев!",
      suggestedPets: [],
      conversationContext: {}
    };
  }

  try {
    // Загружаем данные из БД для предложения вариантов
    const availableBreeds = await getUniqueBreedsFromDB();
    const availableCities = await getUniqueCitiesFromDB();
    const availableEnergyLevels = await getUniqueEnergyLevelsFromDB();
    const availableTemperaments = await getUniqueTemperamentsFromDB();
    
    // Если режим Q&A, используем другую логику
    if (mode === 'qa') {
      return await processQAMessage(userId, message, conversationHistory, availablePets, {
        availableBreeds,
        availableCities,
        availableEnergyLevels,
        availableTemperaments
      });
    }
    
    // Извлекаем предпочтения один раз (справочники БД уже загружены выше — передаём в extract)
    const preloadedForExtract = {
      breeds: availableBreeds,
      cities: availableCities,
      temperaments: availableTemperaments
    };
    const currentContext = await extractPreferencesFromConversation(
      [...conversationHistory, { role: 'user', content: message }],
      preloadedForExtract
    );

    // Формируем контекст того, что уже известно (все 11 параметров по порядку)
    let knownInfoContext = '\n\n---\nЧТО УЖЕ ИЗВЕСТНО:';
    
    // 1. Вид
    knownInfoContext += currentContext.preferredSpecies.length > 0
      ? `\n1️⃣ Вид: ✅ ${currentContext.preferredSpecies.join(', ')}`
      : `\n1️⃣ Вид: ❌ НЕ УКАЗАН`;
    
    // 2. Город
    knownInfoContext += currentContext.preferredCities.length > 0
      ? `\n2️⃣ Город: ✅ ${currentContext.preferredCities.join(', ')}`
      : `\n2️⃣ Город: ❌ НЕ УКАЗАН`;
    
    // 3. Размер
    knownInfoContext += currentContext.preferredSizes.length > 0
      ? `\n3️⃣ Размер: ✅ ${currentContext.preferredSizes.join(', ')}`
      : `\n3️⃣ Размер: ❌ НЕ УКАЗАН`;
    
    // 4. Возраст
    knownInfoContext += currentContext.preferredAgeRange
      ? `\n4️⃣ Возраст: ✅ ${currentContext.preferredAgeRange}`
      : `\n4️⃣ Возраст: ❌ НЕ УКАЗАН`;
    
    // 5. Энергия
    knownInfoContext += currentContext.energyLevel
      ? `\n5️⃣ Энергия: ✅ ${currentContext.energyLevel}`
      : `\n5️⃣ Энергия: ❌ НЕ УКАЗАН`;
    
    // 6. Темперамент
    knownInfoContext += currentContext.preferredTemperaments.length > 0
      ? `\n6️⃣ Темперамент: ✅ ${currentContext.preferredTemperaments.join(', ')}`
      : `\n6️⃣ Темперамент: ❌ НЕ УКАЗАН`;
    
    // 7. Дети
    knownInfoContext += currentContext.hasKids !== null && currentContext.hasKids !== undefined
      ? `\n7️⃣ Дети: ✅ ${currentContext.hasKids ? 'да' : 'нет'}`
      : `\n7️⃣ Дети: ❌ НЕ УКАЗАНО`;
    
    // 8. Другие животные
    knownInfoContext += currentContext.hasOtherPets !== null && currentContext.hasOtherPets !== undefined
      ? `\n8️⃣ Животные: ✅ ${currentContext.hasOtherPets ? 'да' : 'нет'}`
      : `\n8️⃣ Животные: ❌ НЕ УКАЗАНО`;
    
    // 9. Аллергии
    knownInfoContext += currentContext.allergyFriendly !== null && currentContext.allergyFriendly !== undefined
      ? `\n9️⃣ Аллергии: ✅ ${currentContext.allergyFriendly ? 'да' : 'нет'}`
      : `\n9️⃣ Аллергии: ❌ НЕ УКАЗАНО`;
    
    // 10. Жилье
    knownInfoContext += currentContext.livingSpace
      ? `\n🔟 Жилье: ✅ ${currentContext.livingSpace === 'apartment' ? 'квартира' : 'дом'}`
      : `\n🔟 Жилье: ❌ НЕ УКАЗАНО`;
    
    // 11. Опыт
    knownInfoContext += currentContext.experience
      ? `\n1️⃣1️⃣ Опыт: ✅ ${currentContext.experience === 'beginner' ? 'новичок' : 'есть опыт'}`
      : `\n1️⃣1️⃣ Опыт: ❌ НЕ УКАЗАН`;
    
    knownInfoContext += '\n\n➡️ ЗАДАЙ СЛЕДУЮЩИЙ ВОПРОС ПО ПОРЯДКУ (первый с ❌)';

    // Подготовка контекста о доступных питомцах
    const petsContext = availablePets.length > 0 
      ? `\n\nДОСТУПНЫЕ ПИТОМЦЫ В ПРИЮТЕ (${availablePets.length} шт, показано до 20):\n${formatPetsForAI(availablePets.slice(0, 20))}`
      : '';

    // Формирование полного промпта с историей
    // Строим промпт с динамическими данными из БД
    const systemPrompt = await buildSystemPrompt(availableBreeds, availableCities, availableEnergyLevels, availableTemperaments);
    let fullPrompt = systemPrompt + knownInfoContext + petsContext + '\n\n---\nИСТОРИЯ ДИАЛОГА:\n';
    
    // Добавляем историю разговора
    conversationHistory.forEach(msg => {
      const role = msg.role === 'user' ? 'Пользователь' : 'Ассистент';
      fullPrompt += `\n${role}: ${msg.content}`;
    });
    
    // Добавляем текущее сообщение пользователя
    fullPrompt += `\n\nПользователь: ${message}\n\nАссистент:`;

    // Генерация ответа с retry логикой
    let aiResponse;
    let retries = 0;
    const maxRetries = 2;
    let useFallbackModel = false; // Флаг для использования fallback модели
    
    while (retries <= maxRetries) {
      try {
        // Используем fallback модель если основная перегружена
        const modelToUse = useFallbackModel ? 'gemini-2.5-flash' : 'gemini-2.5-flash';
        
        const result = await genAI.models.generateContent({
          model: modelToUse,
          contents: fullPrompt,
          config: {
            temperature: 0.75,
            topK: 32,
            topP: 0.92,
            maxOutputTokens: 1536,
          }
        });
        
        // Пробуем разные способы получения текста ответа
        aiResponse = result.text || result.response?.text() || '';
        
        // Если все еще пусто, пробуем получить из candidates
        if (!aiResponse && result.response?.candidates && result.response.candidates.length > 0) {
          const candidate = result.response.candidates[0];
          aiResponse = candidate.content?.parts?.[0]?.text || '';
        }
        
        // Если все еще пусто, пробуем получить напрямую из result
        if (!aiResponse && result.candidates && result.candidates.length > 0) {
          const candidate = result.candidates[0];
          aiResponse = candidate.content?.parts?.[0]?.text || '';
        }
        
        // Если все еще пусто, пробуем получить через await result.response
        if (!aiResponse) {
          try {
            const response = await result.response;
            aiResponse = response?.text() || '';
          } catch (e) {
            // Игнорируем ошибку
          }
        }
        
        // Проверяем, что ответ не пустой
        if (!aiResponse || aiResponse.trim().length === 0) {
          console.error('⚠️ AI вернул пустой ответ');
          console.log('Структура результата:', JSON.stringify({
            hasText: !!result.text,
            hasResponse: !!result.response,
            hasCandidates: !!(result.response?.candidates || result.candidates),
            keys: Object.keys(result || {})
          }, null, 2));
          
          if (retries < maxRetries) {
            retries++;
            console.log(`🔄 Повторная попытка ${retries}/${maxRetries}...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * retries));
            continue;
          } else {
            throw new Error('AI вернул пустой ответ после всех попыток');
          }
        }
        
        console.log(`✅ Получен ответ от AI (${aiResponse.length} символов)`);
        if (useFallbackModel) {
          console.log('✅ Использована fallback модель gemini-2.5-flash (основная была перегружена)');
        }
        break; // Успешно - выходим из цикла
        
      } catch (error) {
        // Если ошибка 503 (overloaded) - переключаемся на более легкую модель
        const isOverloaded = error.status === 'UNAVAILABLE' || error.code === 503 || error.error?.code === 503;
        
        if (isOverloaded && !useFallbackModel && retries === 0) {
          console.log('⚠️ Модель gemini-2.5-flash перегружена, но переключение всё равно остаётся на flash...');
          useFallbackModel = true;
          retries--; // Не считаем это как попытку, просто меняем модель
          continue;
        }
        
        // Если ошибка 429 (rate limit) или 503 (overloaded) и есть попытки - ждем и повторяем
        const isRetryableError = (
          (error.status === 'RESOURCE_EXHAUSTED' || error.status === 'UNAVAILABLE' || error.code === 503) &&
          retries < maxRetries
        );
        
        if (isRetryableError) {
          const waitTime = Math.pow(2, retries) * 2000; // 2s, 4s, 8s - больше времени для перегруженной модели
          console.log(`⏳ Модель перегружена (${error.status || error.code}), ожидание ${waitTime/1000}s перед повтором...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retries++;
        } else {
          throw error; // Пробрасываем ошибку дальше
        }
      }
    }

    // Проверяем, что aiResponse не пустой перед использованием
    if (!aiResponse || aiResponse.trim().length === 0) {
      console.error('⚠️ aiResponse пустой после всех попыток получения ответа');
      aiResponse = 'Извините, не удалось получить ответ от AI. Попробуйте переформулировать вопрос.';
    }

    // После ответа ассистента в истории на одно сообщение больше — пересчитываем только флаг готовности
    const finalContext = { ...currentContext };
    finalContext.readyToRecommend = computeReadyToRecommend(
      currentContext,
      conversationHistory.length + 2
    );
    finalContext.progress = calculateProgress(finalContext);

    // Подбор питомцев на основе контекста (если есть достаточно информации)
    let suggestedPets = [];
    if (finalContext.readyToRecommend) {
      try {
        // Используем AI рекомендации (как на главной странице)
        const aiRecommendations = await getAIRecommendations(availablePets, finalContext, { limit: 9 });
        
        // Адаптируем формат для чата (нужен только pet объект)
        suggestedPets = aiRecommendations.map(rec => ({
          ...rec.pet,
          matchScore: rec.matchScore || rec.matchPercentage || 0,
          aiReasoning: rec.aiReasoning || ''
        }));
        
        console.log('✅ AI рекомендации для чата:', suggestedPets.length, 'питомцев');
      } catch (aiError) {
        console.error('⚠️ Ошибка AI рекомендаций в чате, используем fallback:', aiError.message);
        // Fallback на rule-based если AI недоступен
        suggestedPets = await findMatchingPets(finalContext, availablePets);
        suggestedPets = suggestedPets.slice(0, 9);
      }
    }

    // Финальная проверка перед возвратом
    const finalResponse = aiResponse && aiResponse.trim().length > 0 
      ? aiResponse.trim() 
      : 'Извините, не удалось обработать запрос. Попробуйте переформулировать вопрос.';

    console.log(`📤 Возвращаем ответ пользователю: ${finalResponse.substring(0, 100)}...`);

    return {
      response: finalResponse,
      suggestedPets: suggestedPets,
      conversationContext: finalContext,
      hasEnoughInfo: finalContext.readyToRecommend
    };

  } catch (error) {
    console.error('❌ Ошибка AI чата:', error.message);
    console.error('Тип ошибки:', error.constructor.name);
    if (error.error) {
      console.error('Детали ошибки:', JSON.stringify(error.error));
    }
    
    // Специфичные сообщения для разных типов ошибок
    let userMessage = "Извините, произошла ошибка. Попробуйте переформулировать вопрос или обратитесь к администратору.";
    
    if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
      userMessage = "Не удается подключиться к AI сервису. Возможно, VPN не подключен или есть проблемы с сетью. Попробуйте позже.";
      console.error('💡 Подсказка: Убедитесь, что VPN включен и сервер перезапущен после включения VPN.');
    } else if (error.message.includes('User location')) {
      userMessage = "AI сервис недоступен в вашем регионе. Необходимо использовать VPN.";
    } else if (error.status === 'UNAVAILABLE' || error.code === 503 || error.error?.code === 503) {
      userMessage = "⏳ AI модель временно перегружена. Пожалуйста, попробуйте через несколько секунд. История диалога сохранена.";
      console.log('💡 Модель Gemini перегружена - это временная проблема на стороне Google.');
    }
    
    return {
      response: userMessage,
      suggestedPets: [],
      conversationContext: {},
      error: error.message
    };
  }
}

/**
 * Форматирование питомцев для AI
 */
function formatPetsForAI(pets) {
  return pets.map((pet, idx) => {
    return `${idx + 1}. ${pet.name || 'Без имени'} - ${pet.species || 'неизвестно'}, ${pet.breed || 'неизвестно'}, ${pet.age || 'возраст неизвестен'}, ${pet.size || 'средний'} размер, ${pet.energyLevel || 'средняя'} энергичность, ${pet.description ? pet.description.substring(0, 72) : 'нет описания'}`;
  }).join('\n');
}

/**
 * Готовность к AI-подбору (учитывает длину диалога: после ответа ассистента +1 сообщение)
 */
function computeReadyToRecommend(context, historyLength) {
  const infoCount = [
    context.preferredSpecies.length > 0,
    context.preferredSizes.length > 0 || context.activityLevel,
    context.hasKids !== null || context.hasOtherPets !== null,
    context.livingSpace || context.allergyFriendly !== null
  ].filter(Boolean).length;

  return infoCount >= 2 && historyLength >= 4;
}

/**
 * Извлечение предпочтений из диалога
 * @param {Array} history — сообщения { role, content }
 * @param {Object} [preloaded] — { breeds, cities, temperaments } из processChatMessage (без повторных запросов к БД)
 */
async function extractPreferencesFromConversation(history, preloaded = {}) {
  const context = {
    preferredSpecies: [],
    preferredBreeds: [],
    preferredSizes: [],
    preferredCities: [],
    preferredAgeRange: '',
    energyLevel: '',
    careLevel: '',
    activityNeeds: '',
    preferredTemperaments: [],
    hasKids: null,
    hasOtherPets: null,
    livingSpace: '',
    allergyFriendly: null,
    experience: '',
    readyToRecommend: false
  };

  // ВАЖНО: Анализируем ТОЛЬКО сообщения пользователя, а не AI!
  const userMessages = history.filter(h => h.role === 'user');
  const fullText = userMessages.map(h => h.content).join(' ').toLowerCase();
  const userTextOriginal = userMessages.map(h => h.content).join(' '); // Оригинальный текст с заглавными буквами

  // Определение вида животного с учетом отрицаний
  // Проверяем последнее сообщение пользователя отдельно для более точного определения
  const lastUserMessage = [...userMessages].reverse()[0]?.content.toLowerCase() || '';
  
  // Функция для проверки, упоминается ли вид с отрицанием
  const isRejected = (text, keywords) => {
    for (const keyword of keywords) {
      const pattern = new RegExp(`(не хочу|не нужн|не интересу|без|только не|кроме).*${keyword}`, 'i');
      if (pattern.test(text)) {
        return true;
      }
    }
    return false;
  };

  // Функция для проверки, упоминается ли вид положительно
  const isMentionedPositively = (text, keywords) => {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        // Проверяем, что нет отрицания перед ключевым словом
        const words = text.split(/\s+/);
        const keywordIndex = words.findIndex(w => w.includes(keyword));
        if (keywordIndex > 0) {
          const prevWord = words[keywordIndex - 1];
          if (prevWord === 'не' || prevWord === 'без' || prevWord === 'кроме') {
            return false;
          }
        }
        return true;
      }
    }
    return false;
  };

  // Проверяем "только" для эксклюзивного выбора
  const hasOnlyKeyword = lastUserMessage.includes('только') || lastUserMessage.includes('давай мне');

  // Собака
  const dogKeywords = ['собак', 'пес', 'щен'];
  if (hasOnlyKeyword && !isMentionedPositively(lastUserMessage, dogKeywords)) {
    // Если есть "только" и собака не упомянута - не добавляем
  } else if (!isRejected(lastUserMessage, dogKeywords) && isMentionedPositively(fullText, dogKeywords)) {
    context.preferredSpecies.push('собака');
  }

  // Кошка
  const catKeywords = ['кошк', 'кот', 'котен'];
  if (hasOnlyKeyword && !isMentionedPositively(lastUserMessage, catKeywords)) {
    // Если есть "только" и кошка не упомянута - не добавляем
  } else if (!isRejected(lastUserMessage, catKeywords) && isMentionedPositively(fullText, catKeywords)) {
    context.preferredSpecies.push('кошка');
  }

  // Птица
  const birdKeywords = ['птиц', 'попугай'];
  if (isMentionedPositively(lastUserMessage, birdKeywords) || 
      (!hasOnlyKeyword && isMentionedPositively(fullText, birdKeywords))) {
    context.preferredSpecies.push('птица');
  }

  // Кролик
  const rabbitKeywords = ['кролик'];
  if (isMentionedPositively(lastUserMessage, rabbitKeywords) || 
      (!hasOnlyKeyword && isMentionedPositively(fullText, rabbitKeywords))) {
    context.preferredSpecies.push('кролик');
  }

  // Размер
  if (fullText.includes('маленьк') || fullText.includes('небольш') || fullText.includes('мини')) {
    context.preferredSizes.push('small');
  }
  if (fullText.includes('средн')) {
    context.preferredSizes.push('medium');
  }
  if (fullText.includes('крупн') || fullText.includes('больш')) {
    context.preferredSizes.push('large');
  }

  // Уровень энергии (energyLevel) - ИСПРАВЛЕНО: поддержка множественных значений
  const energyLevels = [];
  if (fullText.includes('высок') || fullText.includes('очень активн') || fullText.includes('очень энергичн')) {
    energyLevels.push('high');
  }
  if (fullText.includes('средн') && (fullText.includes('энерг') || fullText.includes('активн'))) {
    energyLevels.push('medium');
  }
  if (fullText.includes('низк') || fullText.includes('спокойн') || fullText.includes('ленив') || fullText.includes('тихий')) {
    energyLevels.push('low');
  }
  // Если указано несколько уровней, сохраняем их все через запятую
  if (energyLevels.length > 0) {
    context.energyLevel = energyLevels.join(',');
  }

  // Потребность в активности (activityNeeds)
  if (fullText.includes('много гулять') || fullText.includes('активные прогулки') || fullText.includes('бегать')) {
    context.activityNeeds = 'high';
  } else if (fullText.includes('мало гулять') || fullText.includes('домосед') || fullText.includes('не люблю гулять')) {
    context.activityNeeds = 'low';
  } else if (fullText.includes('прогулки') || fullText.includes('гулять')) {
    context.activityNeeds = 'medium';
  }

  // Сложность ухода (careLevel)
  if (fullText.includes('простой уход') || fullText.includes('легкий уход') || fullText.includes('неприхотлив')) {
    context.careLevel = 'low';
  } else if (fullText.includes('сложный уход') || fullText.includes('требует ухода') || fullText.includes('груминг')) {
    context.careLevel = 'high';
  } else if (fullText.includes('средний уход')) {
    context.careLevel = 'medium';
  }

  // Темперамент (temperamentTraits) - ИСПРАВЛЕНО: берем из БД динамически
  const dbTemperaments = preloaded.temperaments && preloaded.temperaments.length
    ? preloaded.temperaments
    : await getUniqueTemperamentsFromDB();
  const userTextLowerForTemperaments = userTextOriginal.toLowerCase();
  
  // Создаем карту синонимов для более точного распознавания
  const temperamentSynonyms = {
    'дружелюбный': ['дружелюбн', 'дружелюб', 'общительн'],
    'спокойный': ['спокойн', 'уравновешен', 'тихий'],
    'игривый': ['игрив', 'веселый'],
    'энергичный': ['энергичн', 'активн', 'подвижн'],
    'независимый': ['независим', 'самостоятельн'],
    'ласковый': ['ласков', 'нежн', 'привязан'],
    'умный': ['умн', 'сообразительн', 'легко обучаем'],
    'верный': ['верн', 'преданн', 'лояльн'],
    'добрый': ['добр', 'милый', 'хороший'],
    'преданный': ['преданн', 'верн', 'лояльн'],
    'настороженный': ['настороженн', 'осторожн', 'бдительн'],
    'защитник': ['защитник', 'охранник', 'сторож']
  };
  
  for (const temperament of dbTemperaments) {
    const tempLower = temperament.toLowerCase();
    
    // Проверяем точное совпадение
    if (userTextLowerForTemperaments.includes(tempLower)) {
      if (!context.preferredTemperaments.includes(temperament)) {
        context.preferredTemperaments.push(temperament);
        console.log(`✅ Найден темперамент: "${temperament}" (точное совпадение)`);
      }
      continue;
    }
    
    // Проверяем синонимы
    const synonyms = temperamentSynonyms[tempLower] || [];
    const foundBySynonym = synonyms.some(synonym => userTextLowerForTemperaments.includes(synonym));
    
    if (foundBySynonym && !context.preferredTemperaments.includes(temperament)) {
      context.preferredTemperaments.push(temperament);
      console.log(`✅ Найден темперамент: "${temperament}" (через синоним)`);
    }
  }

  // Дети
  if (fullText.includes('дет') || fullText.includes('ребен')) {
    context.hasKids = !fullText.includes('без детей') && !fullText.includes('нет детей');
  }

  // Другие животные
  if (fullText.includes('другие животные') || fullText.includes('есть кот') || fullText.includes('есть собака')) {
    context.hasOtherPets = true;
  }

  // Жилье
  if (fullText.includes('квартир')) {
    context.livingSpace = 'apartment';
  } else if (fullText.includes('дом') || fullText.includes('двор')) {
    context.livingSpace = 'house';
  }

  // Аллергии
  if (fullText.includes('аллерг') || fullText.includes('гипоаллерген')) {
    context.allergyFriendly = true;
  }

  // Опыт
  if (fullText.includes('первый') || fullText.includes('новичок') || fullText.includes('опыта нет')) {
    context.experience = 'beginner';
  } else if (fullText.includes('опыт есть') || fullText.includes('была собака') || fullText.includes('был кот')) {
    context.experience = 'experienced';
  }

  // Города - извлекаем динамически из БД
  const dbCities = preloaded.cities && preloaded.cities.length
    ? preloaded.cities
    : await getUniqueCitiesFromDB();
  
  for (const city of dbCities) {
    const cityLower = city.toLowerCase();
    const userTextLower = userTextOriginal.toLowerCase();
    
    // Проверяем различные варианты упоминания города
    const cityVariants = [
      cityLower,                                    // минск
      `в ${cityLower}`,                             // в минске
      `из ${cityLower}`,                            // из минска
      `город ${cityLower}`,                         // город минск
      cityLower.slice(0, -1) + 'е',                 // минске (для городов на -ск)
      cityLower.slice(0, -1) + 'а',                 // минска
    ];
    
    if (cityVariants.some(variant => userTextLower.includes(variant))) {
      if (!context.preferredCities.includes(city)) {
        context.preferredCities.push(city);
      }
    }
  }

  // Породы - извлекаем динамически из БД с поддержкой частичных совпадений
  const dbBreeds = preloaded.breeds && preloaded.breeds.length
    ? preloaded.breeds
    : await getUniqueBreedsFromDB();
  const userTextLowerForBreeds = userTextOriginal.toLowerCase();
  
  for (const breed of dbBreeds) {
    const breedLower = breed.toLowerCase();
    
    // Разбиваем породу на слова (например, "Лабрадор-ретривер" -> ["лабрадор", "ретривер"])
    const breedWords = breedLower.split(/[-\s]+/).filter(w => w.length > 3);
    
    // Проверяем точное совпадение или частичное (любое слово из породы)
    const isMatch = userTextLowerForBreeds.includes(breedLower) || 
                    breedWords.some(word => {
                      // Ищем слово как отдельное слово в тексте пользователя
                      const regex = new RegExp(`\\b${word}`, 'i');
                      return regex.test(userTextLowerForBreeds);
                    });
    
    if (isMatch && !context.preferredBreeds.includes(breed)) {
      context.preferredBreeds.push(breed);
      console.log(`✅ Найдена порода: "${breed}" (совпадение с текстом пользователя)`);
    }
  }

  // Возраст - ИСПРАВЛЕНО: поддержка множественных значений
  const ageRanges = [];
  if (fullText.includes('щенок') || fullText.includes('котенок') || fullText.includes('молод') || fullText.includes('малыш')) {
    ageRanges.push('young'); // до 1 года
  }
  if (fullText.includes('взрослый') || fullText.includes('взрослое') || fullText.includes('постарше')) {
    ageRanges.push('adult'); // 1-7 лет
  }
  if (fullText.includes('пожилой') || fullText.includes('пожилое') || fullText.includes('старый') || fullText.includes('старое')) {
    ageRanges.push('senior'); // 7+ лет
  }
  // Если указано несколько возрастов, сохраняем их все через запятую
  if (ageRanges.length > 0) {
    context.preferredAgeRange = ageRanges.join(',');
  }

  context.readyToRecommend = computeReadyToRecommend(context, history.length);

  // Логирование для отладки
  console.log('📊 Извлеченные предпочтения:', {
    preferredSpecies: context.preferredSpecies,
    preferredBreeds: context.preferredBreeds,
    preferredCities: context.preferredCities,
    preferredAgeRange: context.preferredAgeRange,
    lastUserMessage: lastUserMessage.substring(0, 100),
    hasOnlyKeyword,
    readyToRecommend: context.readyToRecommend
  });

  // Добавляем расчет прогресса
  context.progress = calculateProgress(context);
  
  return context;
}

/**
 * Расчет прогресса сбора информации
 */
function calculateProgress(context) {
  let progress = 0;
  
  // Веса для каждого критерия (сумма = 100)
  const weights = {
    preferredSpecies: 25,      // Самое важное
    preferredSizes: 10,
    energyLevel: 10,
    activityNeeds: 10,
    hasKids: 10,
    hasOtherPets: 10,
    livingSpace: 10,
    allergyFriendly: 5,
    preferredCities: 5,
    experience: 5
  };

  // Подсчитываем прогресс
  if (context.preferredSpecies?.length > 0) progress += weights.preferredSpecies;
  if (context.preferredSizes?.length > 0) progress += weights.preferredSizes;
  if (context.energyLevel) progress += weights.energyLevel;
  if (context.activityNeeds) progress += weights.activityNeeds;
  if (context.hasKids !== null && context.hasKids !== undefined) progress += weights.hasKids;
  if (context.hasOtherPets !== null && context.hasOtherPets !== undefined) progress += weights.hasOtherPets;
  if (context.livingSpace) progress += weights.livingSpace;
  if (context.allergyFriendly !== null && context.allergyFriendly !== undefined) progress += weights.allergyFriendly;
  if (context.preferredCities?.length > 0) progress += weights.preferredCities;
  if (context.experience) progress += weights.experience;

  return Math.min(progress, 100);
}

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
 * Поиск подходящих питомцев на основе контекста
 */
async function findMatchingPets(context, availablePets) {
  console.log('🔍 Поиск питомцев. Предпочтения:', context.preferredSpecies);
  console.log('📦 Всего доступных питомцев:', availablePets.length);
  
  const scoredPets = availablePets.map(pet => {
    let score = 0;

    // Вид животного (важнейший критерий)
    if (context.preferredSpecies.length > 0) {
      if (context.preferredSpecies.includes(pet.species?.toLowerCase())) {
        score += 40;
      } else {
        // Не тот вид - исключаем
        return null;
      }
    }

    // Порода
    if (context.preferredBreeds.length > 0) {
      if (context.preferredBreeds.includes(pet.breed?.toLowerCase())) {
        score += 25;
      }
    }

    // Размер
    if (context.preferredSizes.length > 0 && context.preferredSizes.includes(pet.size)) {
      score += 15;
    }

    // Уровень энергии
    if (context.energyLevel) {
      if (context.energyLevel === pet.energyLevel) {
        score += 12;
      }
    }

    // Потребность в активности
    if (context.activityNeeds) {
      if (context.activityNeeds === pet.activityNeeds) {
        score += 12;
      }
    }

    // Сложность ухода
    if (context.careLevel) {
      if (context.careLevel === pet.careLevel) {
        score += 10;
      }
    }

    // Темперамент
    if (context.preferredTemperaments.length > 0 && Array.isArray(pet.temperamentTraits)) {
      const matchedTemperaments = context.preferredTemperaments.filter(t => 
        pet.temperamentTraits.includes(t)
      );
      score += matchedTemperaments.length * 8; // 8 баллов за каждый совпавший темперамент
    }

    // Дети
    if (context.hasKids === true && pet.isKidFriendly) {
      score += 15;
    }
    if (context.hasKids === false && !pet.isKidFriendly) {
      score += 5;
    }

    // Другие животные
    if (context.hasOtherPets === true && pet.isPetFriendly) {
      score += 10;
    }

    // Аллергии
    if (context.allergyFriendly === true && pet.hypoallergenic) {
      score += 20;
    }

    return { pet, score };
  }).filter(item => item !== null);

  const results = scoredPets
    .sort((a, b) => b.score - a.score)
    .map(item => ({
      ...item.pet,
      matchScore: item.score
    }));

  console.log('✅ Найдено подходящих питомцев:', results.length);
  if (results.length > 0) {
    console.log('Топ-3:', results.slice(0, 3).map(p => `${p.name} (${p.species})`));
  }

  return results;
}

/**
 * Генерация стартового сообщения
 */
async function getWelcomeMessage(mode = 'selection') {
  if (mode === 'qa') {
    return {
      response: "Привет! 👋 Я отвечу на твои вопросы о животных и приютах.\n\nСпрашивай что угодно! Например:\n• Какая порода подойдет для квартиры?\n• Какие животные есть в приютах?\n• Как ухаживать за определенным животным?",
      suggestedPets: [],
      conversationContext: {},
      isWelcome: true
    };
  }
  
  // Загружаем виды животных из БД динамически
  const availableSpecies = await getUniqueSpeciesFromDB();
  
  // Формируем список видов с правильными падежами для вопроса "кого ты ищешь?"
  const speciesMap = {
    'Собака': 'собаку',
    'Кошка': 'кошку',
    'Птица': 'птицу',
    'Кролик': 'кролика',
    'Грызун': 'грызуна',
    'Хомяк': 'хомяка',
    'Шиншилла': 'шиншиллу',
    'Морская свинка': 'морскую свинку'
  };
  
  const speciesList = availableSpecies
    .map(s => speciesMap[s] || s.toLowerCase())
    .join(', ');
  
  // Эмодзи для видов
  const emojiMap = {
    'Собака': '🐕',
    'Кошка': '🐈',
    'Птица': '🦜',
    'Кролик': '🐰',
    'Грызун': '🐹',
    'Хомяк': '🐹',
    'Шиншилла': '🐭'
  };
  
  const emojis = availableSpecies
    .map(s => emojiMap[s] || '🐾')
    .slice(0, 3)
    .join('');
  
  return {
    response: `Привет! 👋 Я помогу тебе найти идеального питомца из приюта.\n\nРасскажи, кого ты ищешь? ${speciesList.charAt(0).toUpperCase() + speciesList.slice(1)} или может быть кого-то еще? ${emojis}`,
    suggestedPets: [],
    conversationContext: {},
    isWelcome: true
  };
}

/**
 * Получение информации о породе
 */
async function getBreedInfo(breedName, species) {
  if (!genAI) {
    return "AI-помощник временно недоступен.";
  }

  try {
    const prompt = `Расскажи кратко (3-4 предложения) о породе ${species || 'животного'} "${breedName}": 
    - Основные характеристики
    - Темперамент
    - Уровень активности
    - Подходит ли для новичков
    
    Пиши на русском, дружелюбным тоном.`;

    // Retry логика для breed info с fallback на более легкую модель
    let retries = 0;
    const maxRetries = 2;
    let useFallbackModel = false;
    
    while (retries <= maxRetries) {
      try {
        const modelToUse = useFallbackModel ? 'gemini-2.5-flash' : 'gemini-2.5-flash';
        const result = await genAI.models.generateContent({
          model: modelToUse,
          contents: prompt
        });
        return result.text;
        
      } catch (error) {
        // Если модель перегружена (503), переключаемся на более легкую
        const isOverloaded = error.status === 'UNAVAILABLE' || error.code === 503 || error.error?.code === 503;
        
        if (isOverloaded && !useFallbackModel && retries === 0) {
          console.log('⚠️ Модель gemini-2.5-flash перегружена в breed info (fallback логика)...');
          useFallbackModel = true;
          retries--; // Не считаем это как попытку
          continue;
        }
        
        if (error.status === 'RESOURCE_EXHAUSTED' && retries < maxRetries) {
          const waitTime = Math.pow(2, retries) * 1000;
          console.log(`⏳ Rate limit в breed info, ожидание ${waitTime/1000}s...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retries++;
        } else {
          throw error;
        }
      }
    }
  } catch (error) {
    console.error('❌ Ошибка получения информации о породе:', error);
    return "Извините, не удалось получить информацию о породе.";
  }
}

module.exports = {
  processChatMessage,
  getWelcomeMessage,
  getBreedInfo,
  clearCache
};

