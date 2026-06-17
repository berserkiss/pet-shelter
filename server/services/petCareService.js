/**
 * Сервис для генерации персонализированного календаря ухода за питомцем
 * Использует AI для создания рекомендаций на основе вида, породы, возраста
 */

const { GoogleGenAI } = require('@google/genai');
const PetCareCalendar = require('../Model/PetCareCalendarModel');
const Pet = require('../Model/PetModel');

const genAI = process.env.GEMINI_API_KEY 
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

/**
 * Базовые шаблоны событий для разных видов животных
 */
/** Русские / альтернативные названия вида → ключ шаблонов */
const SPECIES_TEMPLATE_KEY = {
  dog: 'dog',
  собака: 'dog',
  'собаки': 'dog',
  cat: 'cat',
  кошка: 'cat',
  кот: 'cat',
  'кошки': 'cat',
  bird: 'bird',
  птица: 'bird',
  птицы: 'bird',
  rabbit: 'rabbit',
  кролик: 'rabbit',
  кролики: 'rabbit'
};

function resolveSpeciesTemplateKey(species) {
  if (!species || typeof species !== 'string') return 'dog';
  const k = species.trim().toLowerCase();
  return SPECIES_TEMPLATE_KEY[k] || (BASE_CARE_TEMPLATES[k] ? k : 'dog');
}

/** Часовой пояс для «сегодня» в календаре (Docker UTC иначе даёт сдвиг на −1 день для UTC+2/+3) */
const DEFAULT_CALENDAR_TZ = process.env.CALENDAR_TZ || 'Europe/Minsk';

/**
 * Календарная дата (сегодня + daysFromNow) в DEFAULT_CALENDAR_TZ, 12:00 UTC —
 * в браузере тот же календарный день, что и у пользователя в этом поясе.
 */
function calendarDateNoonDaysFromNow(daysFromNow = 0, timeZone = DEFAULT_CALENDAR_TZ) {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = fmt.formatToParts(now);
  const y = parseInt(parts.find((p) => p.type === 'year').value, 10);
  const mo = parseInt(parts.find((p) => p.type === 'month').value, 10) - 1;
  const d = parseInt(parts.find((p) => p.type === 'day').value, 10);
  return new Date(Date.UTC(y, mo, d + Number(daysFromNow || 0), 12, 0, 0, 0));
}

function formatCalendarDateRuInTz(timeZone = DEFAULT_CALENDAR_TZ) {
  return new Date().toLocaleDateString('ru-RU', { timeZone });
}

const BASE_CARE_TEMPLATES = {
  dog: [
    { type: 'vaccination', title: 'Комплексная прививка (DHPP)', intervalMonths: 12, priority: 'high' },
    { type: 'vaccination', title: 'Прививка от бешенства', intervalMonths: 12, priority: 'high' },
    { type: 'vet_checkup', title: 'Ежегодный осмотр у ветеринара', intervalMonths: 12, priority: 'medium' },
    { type: 'deworming', title: 'Дегельминтизация', intervalMonths: 3, priority: 'medium' },
    { type: 'flea_treatment', title: 'Обработка от блох и клещей', intervalMonths: 1, priority: 'medium' },
    { type: 'grooming', title: 'Груминг (стрижка, мытье)', intervalMonths: 2, priority: 'low' },
    { type: 'nail_trimming', title: 'Стрижка когтей', intervalMonths: 1, priority: 'low' },
    { type: 'teeth_cleaning', title: 'Чистка зубов', intervalMonths: 6, priority: 'medium' }
  ],
  cat: [
    { type: 'vaccination', title: 'Комплексная прививка (FVRCP)', intervalMonths: 12, priority: 'high' },
    { type: 'vaccination', title: 'Прививка от бешенства', intervalMonths: 12, priority: 'high' },
    { type: 'vet_checkup', title: 'Ежегодный осмотр у ветеринара', intervalMonths: 12, priority: 'medium' },
    { type: 'deworming', title: 'Дегельминтизация', intervalMonths: 3, priority: 'medium' },
    { type: 'flea_treatment', title: 'Обработка от блох', intervalMonths: 1, priority: 'medium' },
    { type: 'grooming', title: 'Вычесывание шерсти', intervalMonths: 1, priority: 'low' },
    { type: 'nail_trimming', title: 'Стрижка когтей', intervalMonths: 2, priority: 'low' }
  ],
  bird: [
    { type: 'vet_checkup', title: 'Осмотр у ветеринара-орнитолога', intervalMonths: 12, priority: 'medium' },
    { type: 'nail_trimming', title: 'Подрезка когтей и клюва', intervalMonths: 3, priority: 'medium' },
    { type: 'custom', title: 'Замена подстилки в клетке', intervalMonths: 0.25, priority: 'low' }, // раз в неделю
    { type: 'custom', title: 'Генеральная уборка клетки', intervalMonths: 1, priority: 'medium' }
  ],
  rabbit: [
    { type: 'vet_checkup', title: 'Осмотр у ветеринара', intervalMonths: 12, priority: 'medium' },
    { type: 'vaccination', title: 'Прививка от миксоматоза', intervalMonths: 6, priority: 'high' },
    { type: 'vaccination', title: 'Прививка от ВГБК', intervalMonths: 6, priority: 'high' },
    { type: 'nail_trimming', title: 'Стрижка когтей', intervalMonths: 2, priority: 'medium' },
    { type: 'teeth_cleaning', title: 'Проверка зубов', intervalMonths: 6, priority: 'medium' },
    { type: 'grooming', title: 'Вычесывание шерсти', intervalMonths: 1, priority: 'low' }
  ]
};

/**
 * Создать календарь ухода для питомца
 */
async function createCareCalendar(userId, petId) {
  try {
    // Проверяем, существует ли уже календарь
    let calendar = await PetCareCalendar.findOne({ userId, petId });
    if (calendar) {
      console.log('Календарь уже существует для этого питомца');
      return calendar;
    }

    // Получаем информацию о питомце
    const pet = await Pet.findById(petId);
    if (!pet) {
      throw new Error('Питомец не найден');
    }

    // Создаем новый календарь
    calendar = new PetCareCalendar({
      userId,
      petId,
      petInfo: {
        name: pet.name,
        species: pet.species,
        breed: pet.breed,
        birthDate: pet.birthDate
      },
      events: []
    });

    // Первичное создание — только быстрые шаблоны (без ожидания Gemini).
    // Долгий AI-запрос на этом шаге давал таймауты / обрыв соединения (ERR_CONNECTION_REFUSED).
    // Персональный AI-календарь — кнопка «AI-календарь» / POST .../regenerate
    await generateBaseCareEvents(calendar, pet);
    
    // Удаляем дубликаты перед сохранением
    removeDuplicateEvents(calendar);
    
    // Обновляем статистику
    calendar.updateStats();

    await calendar.save();
    console.log('✅ Календарь ухода создан:', calendar._id);
    return calendar;
  } catch (error) {
    console.error('Ошибка создания календаря:', error);
    throw error;
  }
}

/**
 * Удаляет дубликаты событий из календаря
 * Дубликаты определяются по: type, title, date, recurring.interval
 * ВАЖНО: Для повторяющихся событий сохраняем только одно событие с каждой датой
 */
function removeDuplicateEvents(calendar) {
  if (!calendar || !calendar.events) return;
  
  const seen = new Map();
  const uniqueEvents = [];
  let duplicatesRemoved = 0;
  
  // Сортируем события по дате для более предсказуемого поведения
  const sortedEvents = [...calendar.events].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateA - dateB;
  });
  
  sortedEvents.forEach(event => {
    const eventDate = new Date(event.date);
    eventDate.setHours(0, 0, 0, 0);
    const dateKey = eventDate.toISOString().split('T')[0];
    
    // ВАЖНО: Для повторяющихся событий используем ID события в ключе,
    // чтобы каждое событие в серии было уникальным и не удалялось при обновлении других
    // Для неповторяющихся событий - только тип, название и дату (без ID)
    const eventId = event._id ? event._id.toString() : `temp_${Math.random()}`;
    
    // Для повторяющихся событий: type_title_date_interval_ID (каждое событие уникально)
    // Для неповторяющихся: type_title_date (дубликаты только если все совпадает)
    const recurringKey = event.recurring?.enabled 
      ? `${event.recurring.interval}` 
      : 'none';
    
    const eventKey = event.recurring?.enabled
      ? `${event.type}_${event.title}_${dateKey}_${recurringKey}_${eventId}`
      : `${event.type}_${event.title}_${dateKey}_${recurringKey}`;
    
    if (!seen.has(eventKey)) {
      seen.set(eventKey, true);
      uniqueEvents.push(event);
    } else {
      duplicatesRemoved++;
      console.log(`🧹 Удален дубликат: ${event.title} на ${dateKey} (ID: ${eventId})`);
    }
  });
  
  if (duplicatesRemoved > 0) {
    console.log(`Всего удалено ${duplicatesRemoved} дубликатов событий`);
    calendar.events = uniqueEvents;
  }
}

/**
 * Доп. события до целевого числа. Раньше цикл был ограничен длиной шаблонов (макс. 7),
 * плюс совпадения с ответом AI отсекались как дубликаты — оставалось ~8 событий.
 */
function generateAdditionalEvents(pet, currentCount, neededCount) {
  const additional = [];
  if (neededCount <= 0) return additional;

  const now = new Date();
  const species = pet.species || 'питомцем';

  const additionalTemplates = [
    { type: 'feeding_schedule', title: 'Контроль режима питания', intervalMonths: 0, priority: 'low' },
    { type: 'exercise', title: 'Активность и нагрузка', intervalMonths: 0, priority: 'medium' },
    { type: 'custom', title: 'Игры и обогащение среды', intervalMonths: 0, priority: 'low' },
    { type: 'custom', title: 'Контроль массы тела', intervalMonths: 1, priority: 'medium' },
    { type: 'custom', title: 'Осмотр кожи и шерсти', intervalMonths: 0.5, priority: 'low' },
    { type: 'custom', title: 'Наблюдение за аппетитом', intervalMonths: 0.25, priority: 'low' },
    { type: 'custom', title: 'Социализация и контакт', intervalMonths: 0, priority: 'low' },
    { type: 'teeth_cleaning', title: 'Гигиена полости рта', intervalMonths: 1, priority: 'medium' },
    { type: 'nail_trimming', title: 'Уход за когтями', intervalMonths: 1, priority: 'low' },
    { type: 'grooming', title: 'Уход за внешним видом', intervalMonths: 0.5, priority: 'low' },
    { type: 'vet_checkup', title: 'Плановый контроль здоровья', intervalMonths: 3, priority: 'medium' },
    { type: 'custom', title: 'Проверка питьевого режима', intervalMonths: 0, priority: 'low' }
  ];

  const MS_DAY = 1000 * 60 * 60 * 24;

  for (let i = 0; i < neededCount; i++) {
    const template = additionalTemplates[i % additionalTemplates.length];
    const title = template.title;
    const eventDate = new Date(now);
    // Уникальный сдвиг даты чтобы события не схлопывались при дедупликации
    const dayOffset = 2 + i + Math.floor(i / additionalTemplates.length) * 2;
    eventDate.setDate(eventDate.getDate() + dayOffset);

    let daysFromNow = Math.round((eventDate - now) / MS_DAY);
    if (!Number.isFinite(daysFromNow) || daysFromNow < 0) daysFromNow = i + 1;

    additional.push({
      type: template.type,
      title,
      description: getEventDescription(template.type, species),
      priority: template.priority,
      daysFromNow,
      intervalMonths: template.intervalMonths,
      isUrgent: false
    });
  }

  return additional;
}

/**
 * Генерировать базовые события на основе вида животного
 */
async function generateBaseCareEvents(calendar, pet) {
  const speciesKey = resolveSpeciesTemplateKey(pet.species);
  const templates = BASE_CARE_TEMPLATES[speciesKey] || BASE_CARE_TEMPLATES.dog;

  const now = new Date();
  const petAge = calculateAgeInMonths(pet.birthDate);

  templates.forEach(template => {
    // Рассчитываем дату первого события
    let eventDate = new Date(now);
    
    // Для молодых животных некоторые события нужны раньше
    if (petAge < 12 && template.type === 'vaccination') {
      eventDate.setDate(now.getDate() + 7); // через неделю
    } else {
      eventDate.setMonth(now.getMonth() + 1); // через месяц
    }

    const event = {
      type: template.type,
      title: template.title,
      description: getEventDescription(template.type, pet.species),
      date: eventDate,
      priority: template.priority,
      recurring: {
        // 0 = ежедневно (см. getRecurringInterval); раньше > 0 отключало все daily-шаблоны
        enabled:
          template.intervalMonths != null &&
          template.intervalMonths !== undefined &&
          Number(template.intervalMonths) >= 0,
        interval: getRecurringInterval(template.intervalMonths),
        endDate: null
      },
      reminders: [
        { type: 'email', timeBeforeEvent: 1440 }, // 1 день
        { type: 'push', timeBeforeEvent: 60 }     // 1 час
      ]
    };

    calendar.events.push(event);
  });

  console.log(`📋 Создано ${calendar.events.length} базовых событий`);
}

/**
 * Генерировать полный календарь событий с помощью AI на основе данных о питомце
 */
async function generateAIRecommendations(calendar, pet) {
  if (!genAI) return;

  try {
    const petAge = calculateAgeInMonths(pet.birthDate);
    const ageCategory = petAge < 12 ? 'молодое' : petAge < 84 ? 'взрослое' : 'пожилое';
    const todayLabel = formatCalendarDateRuInTz();

    const prompt = `Ты - эксперт-ветеринар и специалист по уходу за домашними животными. Создай ПОЛНЫЙ персонализированный календарь ухода за питомцем на основе всех данных о нем.

ИНФОРМАЦИЯ О ПИТОМЦЕ:
- Вид: ${pet.species}
- Порода: ${pet.breed}
- Возраст: ${ageCategory} (${petAge} месяцев, родился ${pet.birthDate ? new Date(pet.birthDate).toLocaleDateString('ru-RU') : 'неизвестно'})
- Размер: ${pet.size || 'средний'}
- Уровень энергии: ${pet.energyLevel || 'средний'}
- Потребность в активности: ${pet.activityNeeds || 'умеренная'}
- Сложность ухода: ${pet.careLevel || 'средняя'}
- Темперамент: ${pet.temperamentTraits?.join(', ') || 'не указан'}
- Подходит для детей: ${pet.isKidFriendly ? 'да' : 'нет'}
- Подходит для других животных: ${pet.isPetFriendly ? 'да' : 'нет'}
- Гипоаллергенный: ${pet.hypoallergenic ? 'да' : 'нет'}
- Особенности здоровья: ${pet.medicalNotes || 'нет особых указаний'}

ТЕКУЩАЯ ДАТА: ${todayLabel}

ЗАДАЧА:
Создай ПОЛНЫЙ календарь событий ухода на ближайшие 12 месяцев. Включи ВСЕ необходимые мероприятия:
1. Ветеринарные процедуры (прививки, осмотры, обработки)
2. Гигиенические процедуры (груминг, стрижка когтей, чистка зубов)
3. Профилактические мероприятия (дегельминтизация, обработка от паразитов)
4. Специфичные для породы процедуры
5. Учитывай возраст питомца (для молодых - более частые визиты к ветеринару)

Формат ответа (JSON массив):
[
  {
    "type": "vaccination|vet_checkup|grooming|deworming|flea_treatment|nail_trimming|teeth_cleaning|feeding_schedule|exercise|medication|custom",
    "title": "Краткое название события (например: 'Комплексная прививка DHPP')",
    "description": "Краткое описание (1-2 предложения) что включает и почему важно",
    "priority": "low|medium|high|urgent",
    "daysFromNow": число (через сколько дней от текущей даты должно произойти первое событие),
    "intervalMonths": число (как часто повторять в месяцах: 0 = ежедневно, 0.25 = еженедельно, 1 = ежемесячно, 12 = ежегодно, null если не повторяется),
    "isUrgent": true/false (если событие критично и должно быть в ближайшие дни)
  }
]

ВАЖНЫЕ ПРАВИЛА:
- Для молодых животных (< 12 месяцев) добавь больше ветеринарных визитов
- Для пожилых животных (> 7 лет) добавь больше профилактических осмотров
- Учитывай специфику породы (например, длинношерстные кошки нуждаются в частом груминге)
- Прививки должны быть срочными (isUrgent: true) если питомец молодой
- Регулярные процедуры (груминг, стрижка когтей) должны повторяться
- ОБЯЗАТЕЛЬНО создай минимум 20 событий для полноценного календаря
- Если событий меньше 20, добавь дополнительные события (кормление, прогулки, игры, проверка здоровья и т.д.)
- Для ежедневных событий (кормление, прогулки) используй daysFromNow: 0, чтобы они начинались с сегодняшнего дня

ВАЖНО: Ответь ТОЛЬКО валидным JSON массивом, без дополнительного текста или markdown.`;

    console.log('Отправка запроса к Gemini API для генерации календаря...');
    
    let responseText = '';
    let retries = 0;
    const maxRetries = 2;
    
    // Попытки с retry логикой
    while (retries <= maxRetries) {
      try {
        const result = await genAI.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: prompt,
          config: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 4096
          }
        });
        
        // Правильное получение текста ответа - пробуем разные варианты
        responseText = result.text || result.response?.text() || '';
        
        // Если все еще пусто, пробуем получить из candidates
        if (!responseText && result.response?.candidates && result.response.candidates.length > 0) {
          const candidate = result.response.candidates[0];
          responseText = candidate.content?.parts?.[0]?.text || '';
        }
        
        // Если все еще пусто, пробуем получить напрямую из result
        if (!responseText && result.candidates && result.candidates.length > 0) {
          const candidate = result.candidates[0];
          responseText = candidate.content?.parts?.[0]?.text || '';
        }
        
        // Если все еще пусто, пробуем получить через await result.response
        if (!responseText) {
          try {
            const response = await result.response;
            responseText = response?.text() || '';
          } catch (e) {
            // Игнорируем ошибку
          }
        }
        
        if (!responseText || responseText.trim().length === 0) {
          console.error('⚠️ Gemini API вернул пустой ответ');
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
            throw new Error('Gemini API вернул пустой ответ после всех попыток');
          }
        }
        
        console.log(`✅ Получен ответ от Gemini API (${responseText.length} символов)`);
        console.log('Первые 300 символов ответа:', responseText.substring(0, 300));
        break; // Успешно - выходим из цикла
        
      } catch (error) {
        console.error(`❌ Ошибка при вызове Gemini API (попытка ${retries + 1}/${maxRetries + 1}):`, error.message);
        
        // Если ошибка rate limit и есть попытки - ждем и повторяем
        if ((error.status === 'RESOURCE_EXHAUSTED' || error.message.includes('429')) && retries < maxRetries) {
          const waitTime = Math.pow(2, retries) * 1000; // 1s, 2s, 4s
          console.log(`⏳ Rate limit, ожидание ${waitTime/1000}s...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retries++;
        } else {
          throw error; // Пробрасываем ошибку дальше
        }
      }
    }

    if (!responseText || responseText.trim().length === 0) {
      console.error('⚠️ AI не вернул ответ после всех попыток');
      console.error('⚠️ Не удалось получить ответ от Gemini API. Проверьте API ключ и доступность сервиса.');
      console.log('🔄 Создание базовых событий как fallback...');
      await generateBaseCareEvents(calendar, pet);
      return;
    }
    
    console.log('📝 Полный ответ AI (первые 500 символов):', responseText.substring(0, 500));

    // Извлекаем JSON: старые regex ломались (1) на ответе без закрывающих ``` (2) на non-greedy ] внутри длинного массива (3) на обрезке без финальной ]
    let jsonText = '';

    console.log('🔍 Поиск JSON в ответе AI...');
    console.log('Первые 200 символов ответа:', responseText.substring(0, 200));

    /** Парсированные рекомендации (заполняется из полного JSON или из восстановления обрезанного) */
    let recommendations = null;

    const stripMarkdownFences = (t) => {
      let s = t.trim();
      if (/^```(?:json)?\s*/i.test(s)) s = s.replace(/^```(?:json)?\s*/i, '');
      s = s.replace(/\s*```\s*$/m, '').trim();
      return s;
    };
    const stripped = stripMarkdownFences(responseText);
    const bracketStart = stripped.indexOf('[');
    if (bracketStart >= 0) {
      jsonText = stripped.slice(bracketStart);
      console.log('✅ Извлечён фрагмент с позиции [ (работает при обрезанном ответе и без закрывающего ```)');
    }
    if (!jsonText) {
      const arrayMatch = responseText.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        jsonText = arrayMatch[0];
        console.log('✅ Найден JSON массив напрямую');
      } else {
        console.log('⚠️ JSON массив не найден в ответе');
      }
    }

    // Если JSON обрезан (не закрыт), пытаемся его восстановить
    if (jsonText && !jsonText.trim().endsWith(']')) {
      console.log('🔧 Обнаружен обрезанный JSON, пытаемся восстановить...');
      
      // Сначала пробуем найти все валидные объекты в массиве
      let validObjects = [];
      let currentObject = '';
      let braceCount = 0;
      let inString = false;
      let escapeNext = false;
      
      // Проходим по тексту и находим все полные объекты
      for (let i = 0; i < jsonText.length; i++) {
        const char = jsonText[i];
        
        if (escapeNext) {
          currentObject += char;
          escapeNext = false;
          continue;
        }
        
        if (char === '\\') {
          currentObject += char;
          escapeNext = true;
          continue;
        }
        
        if (char === '"' && !escapeNext) {
          inString = !inString;
          currentObject += char;
          continue;
        }
        
        if (!inString) {
          if (char === '{') {
            if (braceCount === 0) {
              currentObject = '{';
            } else {
              currentObject += char;
            }
            braceCount++;
          } else if (char === '}') {
            braceCount--;
            currentObject += char;
            if (braceCount === 0 && currentObject.trim()) {
              // Найден полный объект
              try {
                const obj = JSON.parse(currentObject);
                validObjects.push(obj);
                currentObject = '';
              } catch (e) {
                // Игнорируем невалидные объекты
                currentObject = '';
              }
            }
          } else {
            if (braceCount > 0) {
              currentObject += char;
            }
          }
        } else {
          currentObject += char;
        }
      }
      
      if (validObjects.length > 0) {
        recommendations = validObjects;
        console.log(`✅ Исправлен обрезанный JSON: извлечено ${validObjects.length} валидных объектов`);
      } else {
        // Fallback: простой метод - находим последний валидный объект
        let lastBraceIndex = -1;
        inString = false;
        escapeNext = false;
        
        for (let i = jsonText.length - 1; i >= 0; i--) {
          const char = jsonText[i];
          
          if (escapeNext) {
            escapeNext = false;
            continue;
          }
          
          if (char === '\\') {
            escapeNext = true;
            continue;
          }
          
          if (char === '"' && !escapeNext) {
            inString = !inString;
            continue;
          }
          
          if (!inString && char === '}') {
            const afterBrace = jsonText.substring(i + 1).trim();
            if (afterBrace === '' || afterBrace.startsWith(',') || afterBrace.startsWith(']')) {
              lastBraceIndex = i;
              break;
            }
          }
        }
        
        if (lastBraceIndex > 0) {
          let fixedJson = jsonText.substring(0, lastBraceIndex + 1);
          fixedJson = fixedJson.replace(/,\s*$/, '');
          jsonText = fixedJson + ']';
          console.log('🔧 Исправлен обрезанный JSON (fallback): найден последний валидный объект');
        } else {
          const lastCommaIndex = jsonText.lastIndexOf(',');
          if (lastCommaIndex > 0) {
            jsonText = jsonText.substring(0, lastCommaIndex) + ']';
            console.log('🔧 Исправлен обрезанный JSON: удалена последняя запятая');
          }
        }
      }
    }

    // Если ничего не найдено, пробуем найти JSON после текста
    if (!jsonText) {
      const lines = responseText.split('\n');
      let jsonStart = -1;
      let jsonEnd = -1;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('[')) {
          jsonStart = i;
          break;
        }
      }
      
      if (jsonStart >= 0) {
        for (let i = jsonStart; i < lines.length; i++) {
          if (lines[i].trim().endsWith(']')) {
            jsonEnd = i;
            break;
          }
        }
        
        if (jsonEnd >= jsonStart) {
          jsonText = lines.slice(jsonStart, jsonEnd + 1).join('\n');
        }
      }
    }

    if (!jsonText || jsonText.trim().length === 0) {
      console.error('⚠️ AI не вернул валидный JSON');
      console.error('Полный ответ AI:', responseText);
      console.error('Длина ответа:', responseText.length);
      
      // Пробуем создать базовые события как fallback
      console.log('🔄 Создание базовых событий как fallback...');
      await generateBaseCareEvents(calendar, pet);
      return;
    }
    
    console.log(`📝 Извлечен JSON текст (${jsonText.length} символов)`);

    // Очищаем JSON от возможных артефактов
    jsonText = jsonText.trim();
    // Удаляем markdown форматирование если осталось
    jsonText = jsonText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

    // Если recommendations уже установлен из восстановления обрезанного JSON — только валидируем массив
    if (recommendations != null) {
      if (!Array.isArray(recommendations)) {
        console.error('⚠️ Восстановленные данные не массив, сброс к парсингу JSON');
        recommendations = null;
      }
    }

    if (recommendations == null) {
      try {
        recommendations = JSON.parse(jsonText);
        
        // Проверяем, что это массив
        if (!Array.isArray(recommendations)) {
          console.error('⚠️ AI вернул не массив:', typeof recommendations);
          console.log('Полученное значение:', recommendations);
          console.log('🔄 Создание базовых событий как fallback...');
          await generateBaseCareEvents(calendar, pet);
          return;
        }
      } catch (parseError) {
        console.error('⚠️ Ошибка парсинга JSON:', parseError.message);
        console.log('JSON текст (первые 500 символов):', jsonText.substring(0, 500));
        console.log('Полный ответ AI (первые 1000 символов):', responseText.substring(0, 1000));
        console.log('🔄 Создание базовых событий как fallback...');
        await generateBaseCareEvents(calendar, pet);
        return;
      }
    }

    if (!Array.isArray(recommendations) || recommendations.length === 0) {
      console.error('⚠️ Нет валидных рекомендаций после парсинга');
      await generateBaseCareEvents(calendar, pet);
      return;
    }

    console.log(`AI предложил ${recommendations.length} событий для календаря`);

    // Если AI вернул меньше 5 событий — ответ считается нерабочим, используем шаблонный fallback
    const MIN_AI_EVENTS = 5;
    const TARGET_EVENTS = 10;

    if (recommendations.length < MIN_AI_EVENTS) {
      console.log(`AI вернул только ${recommendations.length} событий (< ${MIN_AI_EVENTS}) — используем шаблонный fallback`);
      await generateBaseCareEvents(calendar, pet);
      return;
    }

    // Если событий меньше целевого минимума — дополняем шаблонами (уже без чисел)
    if (recommendations.length < TARGET_EVENTS) {
      const additionalEvents = generateAdditionalEvents(pet, recommendations.length, TARGET_EVENTS - recommendations.length);
      recommendations.push(...additionalEvents);
      console.log(`Добавлено ${additionalEvents.length} дополнительных событий для достижения минимума в ${TARGET_EVENTS} событий`);
    }

    // Добавляем события в календарь с правильными датами
    // Используем Set для отслеживания уже созданных событий, чтобы избежать дубликатов
    const createdEvents = new Set();
    const eventsCountBefore = calendar.events.length;

    recommendations.forEach(rec => {
      // Определяем интервал повторения
      const interval = rec.intervalMonths !== null && rec.intervalMonths !== undefined 
        ? getRecurringInterval(rec.intervalMonths) 
        : null;
      
      let daysOffset = 0;
      if (rec.daysFromNow !== undefined && rec.daysFromNow !== null && Number.isFinite(Number(rec.daysFromNow))) {
        daysOffset = Number(rec.daysFromNow);
      } else if (interval === 'daily') {
        daysOffset = 0;
      } else {
        daysOffset = rec.isUrgent ? 7 : 30;
      }
      const eventDate = calendarDateNoonDaysFromNow(daysOffset);

      // Только значения из enum схемы — иначе save() падает с ValidationError и события не сохраняются
      const allowedTypes = new Set([
        'vaccination', 'vet_checkup', 'grooming', 'deworming', 'flea_treatment',
        'nail_trimming', 'teeth_cleaning', 'feeding_schedule', 'exercise', 'medication', 'custom'
      ]);
      const rawType = (rec.type || 'custom').toString().trim();
      const eventType = allowedTypes.has(rawType) ? rawType : 'custom';
      
      const allowedPriority = new Set(['low', 'medium', 'high', 'urgent']);
      let priority = allowedPriority.has(rec.priority) ? rec.priority : 'medium';
      if (rec.isUrgent) {
        priority = 'urgent';
      }

      const title = (rec.title && String(rec.title).trim()) || 'Событие ухода';

      // Создаем уникальный ключ для проверки дубликатов
      const eventKey = `${eventType}_${title}_${eventDate.toISOString().split('T')[0]}_${interval || 'none'}`;
      
      // Проверяем, не создали ли мы уже такое событие
      if (createdEvents.has(eventKey)) {
        console.log(`⚠️ Пропущен дубликат события: ${title} на ${eventDate.toLocaleDateString()}`);
        return; // Пропускаем дубликат
      }
      
      // Проверяем, нет ли уже такого события в календаре
      const existingEvent = calendar.events.find(e => {
        const eDate = new Date(e.date);
        eDate.setHours(0, 0, 0, 0);
        return eDate.getTime() === eventDate.getTime() &&
               e.type === eventType &&
               e.title === title &&
               e.recurring.enabled === (rec.intervalMonths !== null && rec.intervalMonths !== undefined) &&
               e.recurring.interval === interval;
      });
      
      if (existingEvent) {
        console.log(`⚠️ Событие уже существует: ${title} на ${eventDate.toLocaleDateString()}`);
        return; // Пропускаем, если событие уже есть
      }

      // Создаем событие
      const event = {
        type: eventType,
        title,
        description: rec.description || `Важное мероприятие по уходу за ${pet.species}`,
        date: eventDate,
        priority: priority,
        recurring: {
          enabled: rec.intervalMonths !== null && rec.intervalMonths !== undefined,
          interval: interval || 'monthly',
          endDate: null
        },
        reminders: [
          { 
            type: 'email', 
            timeBeforeEvent: rec.isUrgent ? 1440 : 2880, // 1 день для срочных, 2 дня для обычных
            sent: false
          },
          { 
            type: 'push', 
            timeBeforeEvent: rec.isUrgent ? 60 : 1440, // 1 час для срочных, 1 день для обычных
            sent: false
          }
        ]
      };

      calendar.events.push(event);
      createdEvents.add(eventKey);
    });

    const actuallyAdded = calendar.events.length - eventsCountBefore;
    if (actuallyAdded < recommendations.length) {
      console.log(
        `ℹ️ В календарь записано ${actuallyAdded} из ${recommendations.length} рекомендаций (остальные отброшены как дубликаты существующих).`
      );
    }

    console.log(`✅ После AI в календаре ${calendar.events.length} событий (в обработке было ${recommendations.length} пунктов)`);
  } catch (error) {
    console.error('⚠️ Ошибка генерации AI рекомендаций:', error.message);
    console.error('Стек ошибки:', error.stack);
    try {
      if (calendar && (!calendar.events || calendar.events.length === 0)) {
        console.log('🔄 Fallback: базовые события после ошибки AI');
        await generateBaseCareEvents(calendar, pet);
      }
    } catch (fallbackErr) {
      console.error('⚠️ Не удалось создать базовые события:', fallbackErr.message);
    }
  }
}

/**
 * Получить описание события
 */
function getEventDescription(eventType, species) {
  const descriptions = {
    vaccination: `Важная профилактическая мера для защиты вашего ${species} от опасных заболеваний.`,
    vet_checkup: `Регулярный осмотр поможет выявить проблемы со здоровьем на ранней стадии.`,
    grooming: `Поддержание чистоты и здоровья шерсти/перьев вашего питомца.`,
    deworming: `Профилактика паразитов для здоровья вашего питомца.`,
    flea_treatment: `Защита от блох, клещей и других паразитов.`,
    nail_trimming: `Регулярная стрижка когтей предотвращает дискомфорт и травмы.`,
    teeth_cleaning: `Профилактика зубного камня и заболеваний десен.`
  };
  return descriptions[eventType] || 'Важное мероприятие по уходу за питомцем.';
}

/**
 * Конвертировать интервал в месяцах в тип повторения
 */
function getRecurringInterval(months) {
  if (months === 0 || months < 0.1) return 'daily'; // Меньше 0.1 месяца = ежедневно
  if (months < 0.5) return 'weekly'; // Меньше 0.5 месяца = еженедельно
  if (months === 1) return 'monthly';
  if (months === 12) return 'yearly';
  return 'monthly';
}

/**
 * Рассчитать возраст в месяцах
 */
function calculateAgeInMonths(birthDate) {
  const now = new Date();
  const birth = new Date(birthDate);
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  return Math.max(0, months);
}

/**
 * Получить календарь пользователя для питомца
 */
async function getCareCalendar(userId, petId) {
  const calendar = await PetCareCalendar.findOne({ userId, petId })
    .populate('petId', 'name species breed birthDate');
  
  if (!calendar) {
    return null;
  }
  
  // Удаляем дубликаты
  removeDuplicateEvents(calendar);
  
  // Обрабатываем просроченные повторяющиеся события
  // Создаем следующее событие для просроченных повторяющихся событий
  await processOverdueRecurringEvents(calendar);
  
  // Генерируем будущие события для повторяющихся событий
  // Это создаст события на сегодня и будущие даты, если последнее событие уже прошло
  await generateFutureRecurringEvents(calendar);
  
  calendar.updateStats();
  
  return calendar;
}

/**
 * Обрабатывает просроченные повторяющиеся события
 * Создает просроченные события с заданной периодичностью до текущей даты
 * Помечает их как просроченные (overdue: true)
 */
async function processOverdueRecurringEvents(calendar) {
  if (!calendar || !calendar.events) return;
  
  const now = calendarDateNoonDaysFromNow(0);
  let hasChanges = false;
  
  // Находим все просроченные невыполненные повторяющиеся события
  const overdueRecurringEvents = calendar.events.filter(event => {
    if (event.completed) return false;
    if (!event.recurring || !event.recurring.enabled) return false;
    
    const eventDate = new Date(event.date);
    eventDate.setHours(0, 0, 0, 0);
    return eventDate < now; // Событие в прошлом
  });
  
  if (overdueRecurringEvents.length === 0) {
    return; // Нет просроченных событий
  }
  
  // Группируем по уникальным характеристикам (type, title, interval)
  const eventGroups = new Map();
  
  overdueRecurringEvents.forEach(event => {
    const groupKey = `${event.type}_${event.title}_${event.recurring.interval}`;
    
    if (!eventGroups.has(groupKey)) {
      eventGroups.set(groupKey, []);
    }
    
    eventGroups.get(groupKey).push(event);
  });
  
  // Обрабатываем каждую группу
  for (const [groupKey, groupEvents] of eventGroups) {
    // Находим самое раннее просроченное событие в группе
    const earliestOverdue = groupEvents.reduce((earliest, current) => {
      const earliestDate = new Date(earliest.date);
      earliestDate.setHours(0, 0, 0, 0);
      const currentDate = new Date(current.date);
      currentDate.setHours(0, 0, 0, 0);
      return currentDate < earliestDate ? current : earliest;
    });
    
    const interval = earliestOverdue.recurring.interval;
    let currentDate = new Date(earliestOverdue.date);
    currentDate.setHours(0, 0, 0, 0);
    
    // Генерируем события с заданной периодичностью до текущей даты
    while (currentDate < now) {
      // Проверяем endDate
      if (earliestOverdue.recurring.endDate) {
        const eventEndDate = new Date(earliestOverdue.recurring.endDate);
        eventEndDate.setHours(23, 59, 59, 999);
        if (currentDate > eventEndDate) {
          break; // Вышли за пределы endDate
        }
      }
      
      // Проверяем, существует ли уже событие с такой датой
      const existingEvent = calendar.events.find(e => {
        if (e.completed) return false;
        if (e.type !== earliestOverdue.type || e.title !== earliestOverdue.title) return false;
        if (!e.recurring || !e.recurring.enabled || e.recurring.interval !== interval) return false;
        
        const eDate = new Date(e.date);
        eDate.setHours(0, 0, 0, 0);
        return eDate.getTime() === currentDate.getTime();
      });
      
      // Если события нет, создаем его и помечаем как просроченное
      if (!existingEvent) {
        const newEvent = {
          type: earliestOverdue.type,
          title: earliestOverdue.title,
          description: earliestOverdue.description,
          date: new Date(currentDate),
          priority: earliestOverdue.priority,
          recurring: {
            enabled: true,
            interval: interval,
            endDate: earliestOverdue.recurring.endDate
          },
          reminders: earliestOverdue.reminders ? earliestOverdue.reminders.map(r => ({ ...r, sent: false })) : [],
          completed: false,
          overdue: true // Помечаем как просроченное
        };
        
        calendar.events.push(newEvent);
        hasChanges = true;
      }
      
      // Вычисляем следующую дату в зависимости от интервала
      switch (interval) {
        case 'daily':
          currentDate.setDate(currentDate.getDate() + 1);
          break;
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case 'monthly':
          const currentDay = currentDate.getDate();
          currentDate.setMonth(currentDate.getMonth() + 1);
          if (currentDate.getDate() !== currentDay) {
            currentDate.setDate(0);
          }
          break;
        case 'yearly':
          currentDate.setFullYear(currentDate.getFullYear() + 1);
          break;
      }
      
      currentDate.setHours(0, 0, 0, 0);
    }
  }
  
  // КРИТИЧНО: Удаляем дубликаты перед сохранением
  removeDuplicateEvents(calendar);
  
  // Сохраняем календарь только если были изменения
  if (hasChanges) {
    await calendar.save();
    console.log(`Обработаны просроченные события в календаре ${calendar._id}`);
  }
}

/**
 * Проверяет и создает следующее событие для повторяющихся событий, если его нет
 * Создает только ОДНО следующее событие для каждой группы
 * ПРАВИЛО: Создаем следующее событие ТОЛЬКО если:
 *   1. Последнее событие уже прошло (или сегодня) И
 *   2. Нет невыполненного события в будущем для этой группы
 * ВАЖНО: Эта функция НЕ должна создавать события, которые уже созданы в completeEvent
 */
async function generateFutureRecurringEvents(calendar) {
  if (!calendar || !calendar.events) return;
  
  const now = calendarDateNoonDaysFromNow(0);
  let hasChanges = false;
  
  // Сначала удаляем дубликаты
  removeDuplicateEvents(calendar);
  
  // Группируем повторяющиеся события по уникальным характеристикам
  const recurringGroups = new Map();
  
  calendar.events.forEach(event => {
    if (event.recurring && event.recurring.enabled) {
      const groupKey = `${event.type}_${event.title}_${event.recurring.interval}`;
      
      if (!recurringGroups.has(groupKey)) {
        recurringGroups.set(groupKey, []);
      }
      
      recurringGroups.get(groupKey).push(event);
    }
  });
  
  // Обрабатываем каждую группу
  for (const [groupKey, groupEvents] of recurringGroups) {
    if (groupEvents.length === 0) continue;
    
    // Находим последний невыполненный экземпляр (самую позднюю дату)
    const uncompletedEvents = groupEvents.filter(e => !e.completed);
    
    // Если нет невыполненных событий, пропускаем группу
    if (uncompletedEvents.length === 0) {
      continue;
    }
    
    // Находим последний невыполненный экземпляр (самую позднюю дату)
    const lastInstance = uncompletedEvents.reduce((latest, current) => {
      const latestDate = new Date(latest.date);
      latestDate.setHours(0, 0, 0, 0);
      const currentDate = new Date(current.date);
      currentDate.setHours(0, 0, 0, 0);
      return currentDate > latestDate ? current : latest;
    });
    
    const interval = lastInstance.recurring.interval;
    const lastDate = new Date(lastInstance.date);
    lastDate.setHours(0, 0, 0, 0);
    
    // КРИТИЧНО: Создаем следующее событие ТОЛЬКО если последнее событие уже прошло (или сегодня)
    // Если последнее событие в будущем - не создаем новое, так как оно еще не выполнено
    if (lastDate > now) {
      // Последнее событие в будущем - не создаем новое
      // console.log(`⏭️ Пропущена группа ${groupKey}: последнее событие в будущем (${lastDate.toLocaleDateString('ru-RU')})`);
      continue;
    }
    
    // Если последнее событие в прошлом или сегодня - создаем следующие события, если их еще нет
    // Для ежедневных событий создаем события до текущей даты включительно
    // Для других интервалов создаем только одно следующее событие
    
    if (interval === 'daily') {
      // Для ежедневных событий создаем события от последней даты до текущей даты включительно
      let currentDate = new Date(lastDate);
      currentDate.setHours(0, 0, 0, 0);
      
      // Создаем события до текущей даты включительно
      while (currentDate <= now) {
        // Проверяем endDate
        if (lastInstance.recurring.endDate) {
          const eventEndDate = new Date(lastInstance.recurring.endDate);
          eventEndDate.setHours(23, 59, 59, 999);
          if (currentDate > eventEndDate) {
            break;
          }
        }
        
        // Проверяем, существует ли уже событие с такой датой
        const existingEvent = calendar.events.find(e => {
          if (e.completed) return false;
          if (e.type !== lastInstance.type || e.title !== lastInstance.title) return false;
          if (!e.recurring || !e.recurring.enabled || e.recurring.interval !== interval) return false;
          
          const eDate = new Date(e.date);
          eDate.setHours(0, 0, 0, 0);
          return eDate.getTime() === currentDate.getTime();
        });
        
        // Если события нет, создаем его
        if (!existingEvent) {
          const newEvent = {
            type: lastInstance.type,
            title: lastInstance.title,
            description: lastInstance.description,
            date: new Date(currentDate),
            priority: lastInstance.priority,
            recurring: {
              enabled: true,
              interval: interval,
              endDate: lastInstance.recurring.endDate
            },
            reminders: lastInstance.reminders ? lastInstance.reminders.map(r => ({ ...r, sent: false })) : [],
            completed: false
          };
          
          calendar.events.push(newEvent);
          hasChanges = true;
          console.log(`Создано ежедневное событие: ${newEvent.title} на ${currentDate.toLocaleDateString('ru-RU')}`);
        }
        
        // Переходим к следующему дню
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else {
      // Для других интервалов создаем только одно следующее событие
      let nextDate = new Date(lastDate);
      
      switch (interval) {
        case 'weekly':
          nextDate.setDate(nextDate.getDate() + 7);
          break;
        case 'monthly':
          const currentDay = nextDate.getDate();
          nextDate.setMonth(nextDate.getMonth() + 1);
          if (nextDate.getDate() !== currentDay) {
            nextDate.setDate(0);
          }
          break;
        case 'yearly':
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          break;
      }
      
      nextDate.setHours(0, 0, 0, 0);
      
      // Проверяем endDate
      if (lastInstance.recurring.endDate) {
        const eventEndDate = new Date(lastInstance.recurring.endDate);
        eventEndDate.setHours(23, 59, 59, 999);
        if (nextDate > eventEndDate) {
          continue;
        }
      }
      
      // КРИТИЧНО: Проверяем, существует ли уже событие с такой датой, типом, названием и интервалом
      const existingEvent = calendar.events.find(e => {
        if (e.completed) return false;
        if (e.type !== lastInstance.type || e.title !== lastInstance.title) return false;
        if (!e.recurring || !e.recurring.enabled || e.recurring.interval !== interval) return false;
        
        const eDate = new Date(e.date);
        eDate.setHours(0, 0, 0, 0);
        return eDate.getTime() === nextDate.getTime();
      });
      
      // Если события нет, создаем ОДНО следующее событие
      if (!existingEvent) {
        const newEvent = {
          type: lastInstance.type,
          title: lastInstance.title,
          description: lastInstance.description,
          date: new Date(nextDate),
          priority: lastInstance.priority,
          recurring: {
            enabled: true,
            interval: interval,
            endDate: lastInstance.recurring.endDate
          },
          reminders: lastInstance.reminders ? lastInstance.reminders.map(r => ({ ...r, sent: false })) : [],
          completed: false
        };
        
        calendar.events.push(newEvent);
        hasChanges = true;
        console.log(`Создано следующее событие: ${newEvent.title} на ${nextDate.toLocaleDateString('ru-RU')} (последнее было ${lastDate.toLocaleDateString('ru-RU')})`);
      }
    }
  }
  
  // Удаляем дубликаты перед сохранением
  removeDuplicateEvents(calendar);
  
  // Сохраняем календарь только если были изменения
  calendar.updateStats();
  if (hasChanges) {
    await calendar.save();
    console.log(`✅ Обновлен календарь ${calendar._id}`);
  }
}

/**
 * Получить все календари пользователя
 */
async function getUserCalendars(userId) {
  return await PetCareCalendar.find({ userId })
    .populate('petId', 'name species breed birthDate filename');
}

/**
 * Добавить событие в календарь
 */
async function addEvent(userId, petId, eventData) {
  const calendar = await PetCareCalendar.findOne({ userId, petId });
  if (!calendar) {
    throw new Error('Календарь не найден');
  }

  // Проверяем на дубликаты перед добавлением
  const eventDate = new Date(eventData.date);
  eventDate.setHours(0, 0, 0, 0);
  
  const existingEvent = calendar.events.find(e => {
    const eDate = new Date(e.date);
    eDate.setHours(0, 0, 0, 0);
    return eDate.getTime() === eventDate.getTime() &&
           e.type === eventData.type &&
           e.title === eventData.title &&
           (!eventData.recurring?.enabled || 
            (e.recurring?.enabled && e.recurring?.interval === eventData.recurring?.interval));
  });
  
  if (existingEvent) {
    throw new Error('Событие с такими параметрами уже существует на эту дату');
  }

  calendar.events.push(eventData);
  
  // Удаляем дубликаты перед сохранением
  removeDuplicateEvents(calendar);
  
  await calendar.save();
  calendar.updateStats();
  return calendar;
}

/**
 * Обновить событие
 * ВАЖНО: При обновлении повторяющегося события обновляем только само событие,
 * не трогая будущие экземпляры, чтобы не удалить их как дубликаты
 */
async function updateEvent(userId, petId, eventId, updates) {
  const calendar = await PetCareCalendar.findOne({ userId, petId });
  if (!calendar) {
    throw new Error('Календарь не найден');
  }

  const event = calendar.events.id(eventId);
  if (!event) {
    throw new Error('Событие не найдено');
  }

  // Сохраняем старые значения для проверки, изменились ли критичные поля
  const oldType = event.type;
  const oldTitle = event.title;
  const oldDate = new Date(event.date);
  const oldRecurring = event.recurring ? { ...event.recurring } : null;

  // Обновляем событие
  Object.assign(event, updates);

  // Если событие повторяющееся и изменились критичные поля (тип, название, интервал),
  // то будущие события могут быть неправильно определены как дубликаты.
  // НЕ вызываем removeDuplicateEvents здесь, чтобы не удалить будущие экземпляры
  // Они останутся со старыми параметрами, что нормально - каждое событие независимо

  await calendar.save();
  calendar.updateStats();
  return calendar;
}

/**
 * Отметить событие как выполненное
 * Для повторяющихся событий помечает только конкретный экземпляр по дате
 */
async function completeEvent(userId, petId, eventId, notes = '', eventDate = null) {
  const calendar = await PetCareCalendar.findOne({ userId, petId });
  if (!calendar) {
    throw new Error('Календарь не найден');
  }

  let event = calendar.events.id(eventId);
  if (!event) {
    throw new Error('Событие не найдено');
  }

  // Если передана дата события, проверяем, что это именно тот экземпляр
  if (eventDate) {
    const eventDateObj = new Date(eventDate);
    const eventDateOnly = new Date(eventDateObj.getFullYear(), eventDateObj.getMonth(), eventDateObj.getDate());
    const currentEventDateOnly = new Date(event.date.getFullYear(), event.date.getMonth(), event.date.getDate());
    
    // Если даты не совпадают, ищем событие с нужной датой
    if (eventDateOnly.getTime() !== currentEventDateOnly.getTime()) {
      // Ищем событие с такой же датой среди всех событий календаря
      // Проверяем по ID родительского события или по типу и названию
      const matchingEvent = calendar.events.find(e => {
        const eDateOnly = new Date(e.date.getFullYear(), e.date.getMonth(), e.date.getDate());
        return eDateOnly.getTime() === eventDateOnly.getTime() && 
               e.type === event.type && 
               e.title === event.title &&
               !e.completed &&
               e._id.toString() !== eventId.toString(); // Не то же самое событие
      });
      
      if (matchingEvent) {
        // Нашли событие с нужной датой - помечаем его
        matchingEvent.completed = true;
        matchingEvent.completedAt = new Date();
        if (notes) matchingEvent.notes = notes;
        
        // Если событие повторяющееся, сразу создаем следующее через нужный интервал
        if (matchingEvent.recurring && matchingEvent.recurring.enabled) {
          const nextDate = new Date(matchingEvent.date);
          nextDate.setHours(0, 0, 0, 0);
          
          // Вычисляем следующую дату в зависимости от интервала
          switch (matchingEvent.recurring.interval) {
            case 'daily':
              nextDate.setDate(nextDate.getDate() + 1);
              break;
            case 'weekly':
              nextDate.setDate(nextDate.getDate() + 7);
              break;
            case 'monthly':
              // Для ежемесячных событий: добавляем месяц, но если день не существует в следующем месяце,
              // берем последний день месяца (например, 31 января -> 28/29 февраля)
              const matchingDay = nextDate.getDate();
              nextDate.setMonth(nextDate.getMonth() + 1);
              // Если день не существует в новом месяце (например, 31 -> февраль), берем последний день
              if (nextDate.getDate() !== matchingDay) {
                nextDate.setDate(0); // Устанавливаем на последний день предыдущего месяца
              }
              break;
            case 'yearly':
              nextDate.setFullYear(nextDate.getFullYear() + 1);
              break;
          }
          
          nextDate.setHours(0, 0, 0, 0);
          
          // Проверяем, не превышает ли дата endDate события
          if (!matchingEvent.recurring.endDate || nextDate <= matchingEvent.recurring.endDate) {
            // КРИТИЧНО: Строгая проверка на существование события для предотвращения дубликатов
            const existingEvent = calendar.events.find(e => {
              // Пропускаем выполненные события
              if (e.completed) return false;
              
              // Проверяем тип и название
              if (e.type !== matchingEvent.type || e.title !== matchingEvent.title) return false;
              
              // Проверяем, что это повторяющееся событие с тем же интервалом
              if (!e.recurring || !e.recurring.enabled || e.recurring.interval !== matchingEvent.recurring.interval) return false;
              
              // Проверяем точное совпадение даты
              const eDate = new Date(e.date);
              eDate.setHours(0, 0, 0, 0);
              return eDate.getTime() === nextDate.getTime();
            });
            
            // Если события нет, создаем его
            if (!existingEvent) {
              const newEvent = {
                type: matchingEvent.type,
                title: matchingEvent.title,
                description: matchingEvent.description,
                date: new Date(nextDate),
                priority: matchingEvent.priority,
                recurring: {
                  enabled: true,
                  interval: matchingEvent.recurring.interval,
                  endDate: matchingEvent.recurring.endDate
                },
                reminders: matchingEvent.reminders ? matchingEvent.reminders.map(r => ({ ...r, sent: false })) : [],
                completed: false
              };
              
              calendar.events.push(newEvent);
              console.log(`Создано следующее событие после выполнения (по дате): ${newEvent.title} на ${nextDate.toLocaleDateString('ru-RU')}`);
            } else {
              console.log(`⚠️ Следующее событие уже существует (по дате): ${matchingEvent.title} на ${nextDate.toLocaleDateString('ru-RU')}`);
            }
          }
        }
        
        await calendar.save();
        calendar.updateStats();
        return calendar;
      }
    }
  }

  // Помечаем найденное событие как выполненное
  event.completed = true;
  event.completedAt = new Date();
  if (notes) event.notes = notes;

  // Если событие повторяющееся, сразу создаем следующее через нужный интервал
  // ВАЖНО: Создаем только ОДНО следующее событие, если его еще нет
  if (event.recurring && event.recurring.enabled) {
    const nextDate = new Date(event.date);
    nextDate.setHours(0, 0, 0, 0);
    
    // Вычисляем следующую дату в зависимости от интервала
    switch (event.recurring.interval) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'monthly':
        // Для ежемесячных событий: добавляем месяц, но если день не существует в следующем месяце,
        // берем последний день месяца (например, 31 января -> 28/29 февраля)
        const currentDay = nextDate.getDate();
        nextDate.setMonth(nextDate.getMonth() + 1);
        // Если день не существует в новом месяце (например, 31 -> февраль), берем последний день
        if (nextDate.getDate() !== currentDay) {
          nextDate.setDate(0); // Устанавливаем на последний день предыдущего месяца
        }
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
    }
    
    nextDate.setHours(0, 0, 0, 0);
    
    // Проверяем, не превышает ли дата endDate события
    if (!event.recurring.endDate || nextDate <= event.recurring.endDate) {
      // КРИТИЧНО: Строгая проверка на существование события для предотвращения дубликатов
      // Проверяем по типу, названию, дате и интервалу
      const existingEvent = calendar.events.find(e => {
        // Пропускаем выполненные события
        if (e.completed) return false;
        
        // Проверяем тип и название
        if (e.type !== event.type || e.title !== event.title) return false;
        
        // Проверяем, что это повторяющееся событие с тем же интервалом
        if (!e.recurring || !e.recurring.enabled || e.recurring.interval !== event.recurring.interval) return false;
        
        // Проверяем точное совпадение даты
        const eDate = new Date(e.date);
        eDate.setHours(0, 0, 0, 0);
        return eDate.getTime() === nextDate.getTime();
      });
      
      // Если события нет, создаем ОДНО следующее событие
      if (!existingEvent) {
        const newEvent = {
          type: event.type,
          title: event.title,
          description: event.description,
          date: new Date(nextDate),
          priority: event.priority,
          recurring: {
            enabled: true,
            interval: event.recurring.interval,
            endDate: event.recurring.endDate
          },
          reminders: event.reminders ? event.reminders.map(r => ({ ...r, sent: false })) : [],
          completed: false
        };
        
        calendar.events.push(newEvent);
        console.log(`✅ Создано следующее событие после выполнения: ${newEvent.title} на ${nextDate.toLocaleDateString('ru-RU')}`);
      } else {
        console.log(`⚠️ Следующее событие уже существует: ${event.title} на ${nextDate.toLocaleDateString('ru-RU')}`);
      }
    }
  }
  
  // Удаляем дубликаты перед сохранением
  removeDuplicateEvents(calendar);
  
  await calendar.save();
  calendar.updateStats();
  
  return calendar;
}

/**
 * Удалить событие
 */
async function deleteEvent(userId, petId, eventId) {
  const calendar = await PetCareCalendar.findOne({ userId, petId });
  if (!calendar) {
    throw new Error('Календарь не найден');
  }

  const event = calendar.events.id(eventId);
  if (!event) {
    throw new Error('Событие не найдено');
  }

  // Удаляем событие из массива используя pull
  calendar.events.pull(eventId);
  await calendar.save();
  return calendar;
}

/**
 * Получить предстоящие события для всех питомцев пользователя
 */
async function getUpcomingEvents(userId, daysAhead = 30) {
  const calendars = await PetCareCalendar.find({ userId })
    .populate('petId', 'name species breed filename');

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + daysAhead);

  const allEvents = [];
  calendars.forEach(calendar => {
    const upcomingEvents = calendar.events.filter(event => 
      !event.completed && 
      event.date >= new Date() && 
      event.date <= endDate
    );

    upcomingEvents.forEach(event => {
      allEvents.push({
        ...event.toObject(),
        petInfo: {
          id: calendar.petId._id,
          name: calendar.petId.name,
          species: calendar.petId.species,
          breed: calendar.petId.breed,
          photo: calendar.petId.filename
        }
      });
    });
  });

  return allEvents.sort((a, b) => a.date - b.date);
}

/**
 * AI-помощник для вопросов о календаре и уходе за питомцем
 */
async function askAICareAssistant(userId, petId, question, calendar) {
  if (!genAI) {
    return {
      answer: "AI-помощник временно недоступен. Пожалуйста, обратитесь к ветеринару.",
      suggestions: []
    };
  }

  try {
    const pet = await Pet.findById(petId);
    if (!pet) {
      throw new Error('Питомец не найден');
    }

    const petAge = calculateAgeInMonths(pet.birthDate);
    const ageCategory = petAge < 12 ? 'молодое' : petAge < 84 ? 'взрослое' : 'пожилое';
    
    // Статистика календаря
    const stats = calendar.stats || {};
    const upcomingCount = calendar.events?.filter(e => !e.completed && new Date(e.date) > new Date()).length || 0;
    const overdueCount = calendar.events?.filter(e => !e.completed && new Date(e.date) < new Date()).length || 0;

    const prompt = `Ты - эксперт-консультант по уходу за домашними животными. Помоги пользователю с вопросом о календаре ухода за питомцем.

ИНФОРМАЦИЯ О ПИТОМЦЕ:
- Имя: ${pet.name}
- Вид: ${pet.species}
- Порода: ${pet.breed}
- Возраст: ${ageCategory} (${petAge} месяцев)
- Уровень энергии: ${pet.energyLevel || 'средний'}
- Особенности здоровья: ${pet.medicalNotes || 'нет особых указаний'}

СТАТИСТИКА КАЛЕНДАРЯ:
- Всего событий: ${stats.totalEvents || 0}
- Предстоящих: ${upcomingCount}
- Просроченных: ${overdueCount}
- Выполнено: ${stats.completedEvents || 0}

БЛИЖАЙШИЕ СОБЫТИЯ:
${calendar.events?.slice(0, 5).map(e => `- ${e.title} (${new Date(e.date).toLocaleDateString('ru-RU')}) - ${e.completed ? 'Выполнено' : 'Ожидает'}`).join('\n') || 'Нет событий'}

ВОПРОС ПОЛЬЗОВАТЕЛЯ: "${question}"

ЗАДАЧА:
Ответь на вопрос пользователя дружелюбно и профессионально на русском языке. 
- Если вопрос о конкретном событии - дай детальную информацию
- Если вопрос о здоровье - дай общие рекомендации, но напомни о необходимости консультации с ветеринаром
- Если вопрос о расписании - предложи оптимальное время
- Будь конкретным и полезным

СТИЛЬ:
- Дружелюбный и теплый тон
- Конкретные рекомендации
- Используй эмодзи умеренно
- Ответ должен быть 3-5 предложений

Ответь только текстом, без форматирования.`;

    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        temperature: 0.8,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024
      }
    });
    const answer = result.text || result.response?.text() || '';

    // Генерируем предложения на основе ответа
    const suggestions = generateSuggestions(question, calendar, pet);

    return {
      answer: answer.trim(),
      suggestions
    };
  } catch (error) {
    console.error('Ошибка AI-помощника:', error);
    return {
      answer: "Извините, произошла ошибка при обработке вопроса. Попробуйте переформулировать или обратитесь к ветеринару.",
      suggestions: []
    };
  }
}

/**
 * Генерация предложений на основе вопроса
 */
function generateSuggestions(question, calendar, pet) {
  const questionLower = question.toLowerCase();
  const suggestions = [];

  // Если вопрос о прививках
  if (questionLower.includes('прививк') || questionLower.includes('вакцин')) {
    const nextVaccination = calendar.events?.find(e => 
      e.type === 'vaccination' && !e.completed && new Date(e.date) > new Date()
    );
    if (nextVaccination) {
      suggestions.push({
        text: `Добавить напоминание о прививке "${nextVaccination.title}"`,
        action: 'reminder',
        eventId: nextVaccination._id
      });
    }
  }

  // Если вопрос о ветеринаре
  if (questionLower.includes('ветеринар') || questionLower.includes('осмотр')) {
    suggestions.push({
      text: 'Найти ветеринарные клиники рядом',
      action: 'find_vet'
    });
  }

  // Если вопрос о графике
  if (questionLower.includes('график') || questionLower.includes('расписан')) {
    suggestions.push({
      text: 'Показать все предстоящие события',
      action: 'show_upcoming'
    });
  }

  return suggestions.slice(0, 3);
}

/**
 * Получить AI-аналитику по календарю
 */
async function getAICalendarAnalytics(userId, petId, calendar) {
  if (!genAI) {
    return {
      insights: [],
      recommendations: []
    };
  }

  try {
    const pet = await Pet.findById(petId);
    if (!pet) {
      throw new Error('Питомец не найден');
    }

    const stats = calendar.stats || {};
    const completedEvents = calendar.events?.filter(e => e.completed) || [];
    const overdueEvents = calendar.events?.filter(e => !e.completed && new Date(e.date) < new Date()) || [];
    const upcomingEvents = calendar.events?.filter(e => !e.completed && new Date(e.date) > new Date()) || [];

    const prompt = `Ты - аналитик по уходу за домашними животными. Проанализируй календарь ухода и дай рекомендации.

ИНФОРМАЦИЯ О ПИТОМЦЕ:
- Вид: ${pet.species}
- Порода: ${pet.breed}
- Возраст: ${calculateAgeInMonths(pet.birthDate)} месяцев

СТАТИСТИКА:
- Всего событий: ${stats.totalEvents || 0}
- Выполнено: ${stats.completedEvents || 0}
- Просрочено: ${stats.overdueEvents || 0}
- Предстоящих: ${stats.upcomingEvents || 0}

ПРОСРОЧЕННЫЕ СОБЫТИЯ:
${overdueEvents.slice(0, 5).map(e => `- ${e.title} (${new Date(e.date).toLocaleDateString('ru-RU')})`).join('\n') || 'Нет'}

ЗАДАЧА:
Дай краткий анализ (2-3 предложения) и 3-5 конкретных рекомендаций по улучшению ухода.
Формат ответа (JSON):
{
  "analysis": "краткий анализ на русском",
  "recommendations": [
    {"text": "рекомендация 1", "priority": "high/medium/low"},
    {"text": "рекомендация 2", "priority": "high/medium/low"}
  ]
}

ВАЖНО: Ответь ТОЛЬКО JSON объектом, без дополнительного текста.`;

    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048
      }
    });
    const responseText = result.text || result.response?.text() || '';

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        insights: [],
        recommendations: []
      };
    }

    const analytics = JSON.parse(jsonMatch[0]);
    return {
      insights: [analytics.analysis || ''],
      recommendations: analytics.recommendations || []
    };
  } catch (error) {
    console.error('❌ Ошибка AI-аналитики:', error);
    return {
      insights: [],
      recommendations: []
    };
  }
}

/**
 * Перегенерировать события календаря с помощью AI
 */
async function regenerateAICalendarEvents(userId, petId) {
  try {
    const calendar = await PetCareCalendar.findOne({ userId, petId });
    if (!calendar) {
      throw new Error('Календарь не найден');
    }

    const pet = await Pet.findById(petId);
    if (!pet) {
      throw new Error('Питомец не найден');
    }

    if (!genAI) {
      throw new Error('AI недоступен. Убедитесь, что GEMINI_API_KEY установлен в переменных окружения.');
    }

    // Сохраняем только пользовательские события (созданные вручную)
    // Удаляем все события, которые были созданы автоматически при создании календаря
    // Оставляем только те, которые пользователь добавил вручную после создания календаря
    const originalEventCount = calendar.events.length;
    
    // Удаляем все события, чтобы создать новый календарь с нуля
    // В будущем можно добавить метку isAIGenerated для более точной фильтрации
    calendar.events = [];

    // Генерируем новые события с помощью AI
    await generateAIRecommendations(calendar, pet);

    if (!calendar.events || calendar.events.length === 0) {
      console.warn('⚠️ После AI календарь пуст — добавляем базовые события');
      await generateBaseCareEvents(calendar, pet);
    }

    removeDuplicateEvents(calendar);
    calendar.updateStats();

    await calendar.save();
    console.log(`Календарь перегенерирован: удалено ${originalEventCount} старых событий, создано ${calendar.events.length} новых AI-событий`);

    return calendar;
  } catch (error) {
    console.error('❌ Ошибка перегенерации календаря:', error);
    throw error;
  }
}

module.exports = {
  createCareCalendar,
  getCareCalendar,
  generateFutureRecurringEvents,
  getUserCalendars,
  addEvent,
  updateEvent,
  completeEvent,
  deleteEvent,
  getUpcomingEvents,
  askAICareAssistant,
  getAICalendarAnalytics,
  regenerateAICalendarEvents
};

