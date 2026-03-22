/**
 * AI-powered Pet Recommendation Service
 * Использует Google Gemini API для интеллектуальных рекомендаций
 */

const { GoogleGenAI, Type } = require('@google/genai');
const { scorePetsForUser } = require('./recommendationService');

// Инициализация Gemini AI
const genAI = process.env.GEMINI_API_KEY 
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

/**
 * Генерирует AI-рекомендации для питомцев на основе предпочтений пользователя
 * @param {Array} pets - Массив всех доступных питомцев
 * @param {Object} preferences - Предпочтения пользователя
 * @param {Object} options - Дополнительные опции (limit)
 * @returns {Promise<Array>} - Массив рекомендованных питомцев с оценками
 */
async function getAIRecommendations(pets = [], preferences = {}, options = {}) {
  const limit = Number(options.limit) || 12;

  // Если нет API ключа, возвращаем базовые рекомендации
  if (!genAI) {
    console.warn('⚠️ GEMINI_API_KEY не установлен. Используются базовые рекомендации.');
    return getBasicRecommendations(pets, preferences, limit);
  }

  try {
    // Все питомцы из массива участвуют в подсчёте scorePetsForUser; в промпт Gemini
    // попадает только топ-N по совпадению с предпочтениями (не «первые N в БД»).
    // Размер N — баланс скорость/охват; при полном нуле совпадений см. fallback в recommendationService.
    const CANDIDATE_LIMIT = Math.min(50, pets.length);
    const scoredCandidates = scorePetsForUser(pets, preferences, { limit: CANDIDATE_LIMIT });
    const candidatePets = scoredCandidates.map((item) => item.pet);

    // Подготовка данных для AI (только кандидаты)
    const petsSummary = candidatePets.map((pet, idx) => {
      // Вычисляем возраст из birthDate
      let ageInMonths = 0;
      if (pet.birthDate) {
        const now = new Date();
        const birth = new Date(pet.birthDate);
        ageInMonths = Math.floor((now - birth) / (1000 * 60 * 60 * 24 * 30));
      }
      
      const ageYears = Math.floor(ageInMonths / 12);
      const ageMonthsRemainder = ageInMonths % 12;
      let ageString = 'неизвестно';
      
      if (ageYears > 0) {
        ageString = `${ageYears} ${ageYears === 1 ? 'год' : ageYears < 5 ? 'года' : 'лет'}`;
        if (ageMonthsRemainder > 0) {
          ageString += ` ${ageMonthsRemainder} ${ageMonthsRemainder === 1 ? 'месяц' : ageMonthsRemainder < 5 ? 'месяца' : 'месяцев'}`;
        }
      } else if (ageInMonths > 0) {
        ageString = `${ageInMonths} ${ageInMonths === 1 ? 'месяц' : ageInMonths < 5 ? 'месяца' : 'месяцев'}`;
      }

      return {
        id: idx,
        name: pet.name || 'Без имени',
        species: pet.species || 'неизвестно',
        breed: pet.breed || 'неизвестно',
        age: ageString,
        ageInMonths: ageInMonths,
        city: pet.area || 'неизвестно',
        size: pet.size || 'medium',
        energyLevel: pet.energyLevel || 'medium',
        careLevel: pet.careLevel || 'medium',
        isKidFriendly: pet.isKidFriendly || false,
        isPetFriendly: pet.isPetFriendly || false,
        hypoallergenic: pet.hypoallergenic || false,
        temperamentTraits: pet.temperamentTraits || [],
        description: (pet.description || '').substring(0, 100)
      };
    });

    const userPrefs = {
      preferredSpecies: preferences.preferredSpecies || [],
      preferredBreeds: preferences.preferredBreeds || [],
      preferredSizes: preferences.preferredSizes || [],
      preferredCities: preferences.preferredCities || [],
      preferredAgeRange: preferences.preferredAgeRange || '',
      energyLevel: preferences.energyLevel || '',
      activityNeeds: preferences.activityNeeds || '',
      careLevel: preferences.careLevel || '',
      hasKids: preferences.hasKids || false,
      hasOtherPets: preferences.hasOtherPets || false,
      allergyFriendly: preferences.allergyFriendly || false,
      preferredTemperaments: preferences.preferredTemperaments || [],
      livingSpace: preferences.livingSpace || ''
    };

    console.log('📊 Предпочтения пользователя для AI рекомендаций:', userPrefs);

    // Создание промпта для AI
    const prompt = `
Ты - эксперт по подбору домашних животных. Проанализируй список питомцев и предпочтения пользователя, затем порекомендуй наиболее подходящих питомцев.

ПРЕДПОЧТЕНИЯ ПОЛЬЗОВАТЕЛЯ:
${JSON.stringify(userPrefs, null, 2)}

КАНДИДАТЫ (предварительно отобраны по предпочтениям, id — индекс в этом списке):
${JSON.stringify(petsSummary, null, 2)}

ЗАДАЧА:
1. Выбери лучших из списка кандидатов по соответствию предпочтениям
2. Учитывай ВСЕ критерии:
   - Вид животного (самое важное!)
   - Порода
   - Возраст (age, ageInMonths) - младше лучше для семей с детьми, старше - для спокойных людей
   - Город (city) - близость к пользователю важна!
   - Размер
   - Уровень энергии (energyLevel)
   - Потребность в активности (activityNeeds)
   - Сложность ухода (careLevel)
   - Темперамент (temperamentTraits)
   - Совместимость с детьми (isKidFriendly)
   - Совместимость с животными (isPetFriendly)
   - Гипоаллергенность (hypoallergenic)
3. Верни JSON массив с топ-${limit} рекомендациями

ВАЖНО:
- matchScore от 0 до 100
- Сортируй по убыванию matchScore
- Верни ровно ${limit} рекомендаций (или меньше, если питомцев меньше)
- reasoning: ОДНО короткое предложение, максимум 90 символов. Без кавычек ". Без длинных перечислений в скобках.
- matchedTraits: 2–4 коротких слова или фразы без двоеточий (например: птица, витебск, жако)
`;

    /** Схема ответа: валидный JSON без обрывов строк и лишних кавычек в reasoning */
    const recommendationsResponseSchema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          petId: { type: Type.INTEGER, description: 'Индекс питомца в списке кандидатов (поле id)' },
          matchScore: { type: Type.INTEGER, description: 'Оценка 0–100' },
          reasoning: {
            type: Type.STRING,
            description: 'Одно предложение до 90 символов',
            maxLength: '120'
          },
          matchedTraits: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ['petId', 'matchScore', 'reasoning', 'matchedTraits'],
        propertyOrdering: ['petId', 'matchScore', 'reasoning', 'matchedTraits']
      }
    };

    /**
     * Если массив оборвался по лимиту токенов — забираем только полностью закрытые объекты {...}.
     */
    function salvageRecommendationObjects(raw) {
      const s = String(raw || '').trim();
      const open = s.indexOf('[');
      if (open === -1) return null;
      const items = [];
      let i = open + 1;

      while (i < s.length) {
        while (i < s.length && /\s|,/.test(s[i])) i++;
        if (i >= s.length || s[i] === ']') break;
        if (s[i] !== '{') break;

        const objStart = i;
        let depth = 0;
        let inString = false;
        let escape = false;
        let foundEnd = false;

        for (let j = i; j < s.length; j++) {
          const c = s[j];
          if (escape) {
            escape = false;
            continue;
          }
          if (inString) {
            if (c === '\\') {
              escape = true;
              continue;
            }
            if (c === '"') inString = false;
            continue;
          }
          if (c === '"') {
            inString = true;
            continue;
          }
          if (c === '{') depth++;
          else if (c === '}') {
            depth--;
            if (depth === 0) {
              const slice = s.slice(objStart, j + 1);
              try {
                const obj = JSON.parse(slice);
                const pid = obj.petId;
                if (obj && (typeof pid === 'number' || (typeof pid === 'string' && pid !== ''))) {
                  items.push({ ...obj, petId: Number(pid) });
                }
              } catch (_) {
                /* пропускаем битый объект */
              }
              i = j + 1;
              foundEnd = true;
              break;
            }
          }
        }
        if (!foundEnd) break;
      }

      return items.length > 0 ? items : null;
    }

    /**
     * Вырезает первый топ-уровневый JSON-массив [ ... ] с учётом строк и escape.
     */
    function extractTopLevelJsonArray(raw) {
      const text = String(raw || '');
      const start = text.indexOf('[');
      if (start === -1) return null;
      let depth = 0;
      let inString = false;
      let escape = false;
      for (let i = start; i < text.length; i++) {
        const c = text[i];
        if (escape) {
          escape = false;
          continue;
        }
        if (inString) {
          if (c === '\\') {
            escape = true;
            continue;
          }
          if (c === '"') inString = false;
          continue;
        }
        if (c === '"') {
          inString = true;
          continue;
        }
        if (c === '[') depth++;
        else if (c === ']') {
          depth--;
          if (depth === 0) return text.slice(start, i + 1);
        }
      }
      return null;
    }

    function parseRecommendationsJson(text) {
      const cleaned = String(text || '')
        .replace(/```json\n?/gi, '')
        .replace(/```\n?/g, '')
        .trim();
      try {
        return JSON.parse(cleaned);
      } catch (firstErr) {
        const slice = extractTopLevelJsonArray(cleaned);
        if (slice) {
          try {
            return JSON.parse(slice);
          } catch (e) {
            /* fall through */
          }
        }
        const salvaged = salvageRecommendationObjects(cleaned);
        if (salvaged && salvaged.length > 0) {
          console.warn(
            `⚠️ Ответ AI с JSON обрезан по лимиту; использовано ${salvaged.length} полных рекомендаций из массива.`
          );
          return salvaged;
        }
        throw firstErr;
      }
    }

    // Вызов Gemini API с retry (парсинг / rate limit)
    let text;
    let parseAttempts = 0;
    const maxParseRetries = 2;
    let rateRetries = 0;
    const maxRateRetries = 2;

    let structuredOk = true;
    let useThinkingBudgetZero = true;
    while (true) {
      try {
        const config = {
          temperature: 0.35,
          maxOutputTokens: 8192,
          topP: 0.9,
          topK: 24
        };
        if (useThinkingBudgetZero) {
          config.thinkingConfig = { thinkingBudget: 0 };
        }
        if (structuredOk) {
          config.responseMimeType = 'application/json';
          config.responseSchema = recommendationsResponseSchema;
        }
        const result = await genAI.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config
        });
        text = result.text;
        break;
      } catch (error) {
        const msg = (error.message || '').toLowerCase();
        if (
          useThinkingBudgetZero &&
          (msg.includes('thinking') || msg.includes('thinkingbudget') || msg.includes('thinking_config'))
        ) {
          console.warn('⚠️ thinkingConfig не поддерживается моделью, повтор без него:', error.message);
          useThinkingBudgetZero = false;
          continue;
        }
        if (structuredOk && (error.message || '').match(/schema|responseSchema|responseMimeType|json/i)) {
          console.warn('⚠️ Structured output недоступен, повтор без схемы:', error.message);
          structuredOk = false;
          continue;
        }
        if (error.status === 'RESOURCE_EXHAUSTED' && rateRetries < maxRateRetries) {
          const waitTime = Math.pow(2, rateRetries) * 1000;
          console.log(`⏳ Rate limit в рекомендациях, ожидание ${waitTime / 1000}s...`);
          await new Promise((r) => setTimeout(r, waitTime));
          rateRetries++;
          continue;
        }
        throw error;
      }
    }

    let aiRecommendations;
    while (parseAttempts <= maxParseRetries) {
      try {
        aiRecommendations = parseRecommendationsJson(text);
        if (!Array.isArray(aiRecommendations)) {
          throw new Error('Ответ AI не является JSON-массивом');
        }
        break;
      } catch (parseError) {
        parseAttempts++;
        console.error('❌ Ошибка парсинга ответа AI:', parseError.message);
        console.log('Ответ AI (фрагмент):', String(text || '').slice(0, 1200));

        if (parseAttempts > maxParseRetries) {
          return getBasicRecommendations(pets, preferences, limit);
        }

        // Повтор запроса — часто после обрыва JSON из-за лимита токенов
        try {
          const retryPrompt = `${prompt}\n\nВерни один валидный JSON-массив без markdown. В поле reasoning не используй двойные кавычки.`;
          const result = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: retryPrompt,
            config: {
              temperature: 0.25,
              maxOutputTokens: 8192,
              topP: 0.9
            }
          });
          text = result.text;
        } catch (e) {
          console.error('❌ Повторный запрос рекомендаций не удался:', e.message);
          return getBasicRecommendations(pets, preferences, limit);
        }
      }
    }

    // Маппинг AI рекомендаций на реальных питомцев
    const recommendations = aiRecommendations
      .filter((rec) => {
        const id = Number(rec.petId);
        return rec.petId !== undefined && rec.petId !== null && !Number.isNaN(id) && candidatePets[id];
      })
      .map((rec) => {
        const pet = candidatePets[Number(rec.petId)];
        return {
          pet: pet && typeof pet.toObject === 'function' ? pet.toObject() : { ...pet },
          matchScore: rec.matchScore || 0,
          matchPercentage: rec.matchScore || 0,
          matchedTraits: rec.matchedTraits || [],
          aiReasoning: rec.reasoning || ''
        };
      })
      .slice(0, limit);

    console.log(`✅ AI рекомендации сгенерированы: ${recommendations.length} питомцев`);
    return recommendations;

  } catch (error) {
    console.error('❌ Ошибка AI рекомендаций:', error.message);
    console.error('Тип ошибки:', error.constructor.name);
    
    if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
      console.error('💡 Подсказка: Проблема с сетевым подключением. Убедитесь, что VPN включен и сервер перезапущен.');
    }
    
    // Fallback на базовые рекомендации
    return getBasicRecommendations(pets, preferences, limit);
  }
}

/**
 * Базовые рекомендации (fallback без AI)
 */
function getBasicRecommendations(pets, preferences, limit) {
  console.log('ℹ️ Используются базовые рекомендации (без AI)');
  
  const scoredPets = pets.map(pet => {
    let score = 0;
    const matched = [];

    // Вид животного (важнейший критерий)
    if (preferences.preferredSpecies?.length > 0) {
      if (preferences.preferredSpecies.includes(pet.species)) {
        score += 40;
        matched.push('вид');
      } else {
        // Не тот вид - исключаем
        return null;
      }
    }

    // Порода
    if (preferences.preferredBreeds?.length > 0) {
      if (preferences.preferredBreeds.includes(pet.breed)) {
        score += 25;
        matched.push('порода');
      }
    }

    // Размер
    if (preferences.preferredSizes?.length > 0) {
      if (preferences.preferredSizes.includes(pet.size)) {
        score += 15;
        matched.push('размер');
      }
    }

    // Уровень энергии
    if (preferences.energyLevel) {
      if (preferences.energyLevel === pet.energyLevel) {
        score += 12;
        matched.push('энергичность');
      }
    }

    // Потребность в активности
    if (preferences.activityNeeds) {
      if (preferences.activityNeeds === pet.activityNeeds) {
        score += 12;
        matched.push('активность');
      }
    }

    // Сложность ухода
    if (preferences.careLevel) {
      if (preferences.careLevel === pet.careLevel) {
        score += 10;
        matched.push('уход');
      }
    }

    // Темперамент
    if (preferences.preferredTemperaments?.length > 0 && Array.isArray(pet.temperamentTraits)) {
      const matchedTemperaments = preferences.preferredTemperaments.filter(t => 
        pet.temperamentTraits.includes(t)
      );
      if (matchedTemperaments.length > 0) {
        score += matchedTemperaments.length * 8;
        matched.push('темперамент');
      }
    }

    // Дружелюбие к детям
    if (preferences.hasKids && pet.isKidFriendly) {
      score += 15;
      matched.push('дружелюбен к детям');
    }

    // Дружелюбие к животным
    if (preferences.hasOtherPets && pet.isPetFriendly) {
      score += 10;
      matched.push('дружелюбен к животным');
    }

    // Гипоаллергенность
    if (preferences.allergyFriendly && pet.hypoallergenic) {
      score += 20;
      matched.push('гипоаллергенный');
    }

    return {
      pet: pet && typeof pet.toObject === 'function' ? pet.toObject() : { ...pet },
      matchScore: score,
      matchPercentage: score,
      matchedTraits: matched
    };
  }).filter(item => item !== null);

  return scoredPets
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
}

/**
 * AI-рекомендация при сравнении избранных питомцев
 * @param {Array} pets - Массив питомцев для сравнения (2-4 шт)
 * @param {Object} preferences - Предпочтения пользователя
 * @returns {Promise<{ recommendation: string, recommendedPetId?: string }>}
 */
async function getCompareRecommendation(pets = [], preferences = {}) {
  if (!genAI || !pets || pets.length < 2) {
    return {
      recommendation: 'Добавьте минимум двух питомцев в избранное для сравнения.',
      recommendedPetId: null
    };
  }

  const petsSummary = pets.map((pet, idx) => {
    let ageInMonths = 0;
    if (pet.birthDate) {
      const now = new Date();
      const birth = new Date(pet.birthDate);
      ageInMonths = Math.floor((now - birth) / (1000 * 60 * 60 * 24 * 30));
    }
    const ageYears = Math.floor(ageInMonths / 12);
    const ageMonthsRemainder = ageInMonths % 12;
    let ageString = ageYears > 0
      ? `${ageYears} ${ageYears === 1 ? 'год' : ageYears < 5 ? 'года' : 'лет'}`
      : `${ageMonthsRemainder} ${ageMonthsRemainder === 1 ? 'месяц' : ageMonthsRemainder < 5 ? 'месяца' : 'месяцев'}`;

    return {
      id: pet._id?.toString(),
      name: pet.name || 'Без имени',
      species: pet.species || 'неизвестно',
      breed: pet.breed || 'неизвестно',
      age: ageString,
      size: pet.size || 'medium',
      energyLevel: pet.energyLevel || 'medium',
      careLevel: pet.careLevel || 'medium',
      activityNeeds: pet.activityNeeds || 'moderate',
      isKidFriendly: pet.isKidFriendly || false,
      isPetFriendly: pet.isPetFriendly || false,
      hypoallergenic: pet.hypoallergenic || false,
      temperamentTraits: pet.temperamentTraits || [],
      area: pet.area || 'не указан',
      description: (pet.description || '').substring(0, 200)
    };
  });

  const userPrefs = {
    preferredSpecies: preferences.preferredSpecies || [],
    preferredBreeds: preferences.preferredBreeds || [],
    preferredSizes: preferences.preferredSizes || [],
    preferredCities: preferences.preferredCities || [],
    preferredAgeRange: preferences.preferredAgeRange || '',
    energyLevel: preferences.energyLevel || '',
    activityNeeds: preferences.activityNeeds || preferences.activityLevel || '',
    careLevel: preferences.careLevel || '',
    hasKids: preferences.hasKids || false,
    hasOtherPets: preferences.hasOtherPets || false,
    allergyFriendly: preferences.allergyFriendly || false,
    preferredTemperaments: preferences.preferredTemperaments || [],
    livingSpace: preferences.livingSpace || ''
  };

  const prompt = `
Ты — эксперт по подбору домашних животных. Пользователь сравнивает нескольких питомцев из избранного и хочет понять, кто ему подойдёт лучше.

ПРЕДПОЧТЕНИЯ ПОЛЬЗОВАТЕЛЯ:
${JSON.stringify(userPrefs, null, 2)}

ПИТОМЦЫ ДЛЯ СРАВНЕНИЯ:
${JSON.stringify(petsSummary, null, 2)}

ЗАДАЧА:
Напиши развёрнутую, но читаемую рекомендацию на русском (4–8 предложений): кого из этих питомцев лучше выбрать с учётом предпочтений пользователя. Укажи имя питомца и конкретные причины. Будь дружелюбным и понятным.

ВАЖНО: обязательно заверши текст полным предложением — последний символ должен быть точкой (.), вопросительным или восклицательным знаком. Не обрывай мысль на полуслове.

После рекомендации ОБЯЗАТЕЛЬНО добавь новую строку (отдельный абзац). На этой строке только латиница и id, без другого текста:
RECOMMENDED_PET_ID:<id>
где <id> — ровно одна из строк поля "id" из блока «ПИТОМЦЫ ДЛЯ СРАВНЕНИЯ» (того питомца, которого ты рекомендуешь предпочесть остальным).

ФОРМАТ: сначала текст рекомендации, затем пустая строка, затем одна строка RECOMMENDED_PET_ID:... Без Markdown-заголовков и маркированных списков в основном тексте.
`;

  const splitRecommendationAndPetId = (rawText, pets) => {
    const validIds = new Set((pets || []).map((p) => String(p._id || '')));
    const text = (rawText || '').trim();
    if (!text) return { recommendation: '', recommendedPetId: null };
    const lines = text.split('\n');
    let recommendedPetId = null;
    let cutIndex = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      const m = lines[i].trim().match(/^RECOMMENDED_PET_ID:\s*([a-fA-F0-9]{24})\s*$/);
      if (m) {
        if (validIds.has(m[1])) recommendedPetId = m[1];
        cutIndex = i;
        break;
      }
    }
    const recommendation =
      cutIndex >= 0 ? lines.slice(0, cutIndex).join('\n').trim() : text;
    return { recommendation, recommendedPetId };
  };

  try {
    /**
     * Обрыв на полуслове (часто при MAX_TOKENS у Gemini 2.5 из‑за «thinking» в лимите).
     * Строку RECOMMENDED_PET_ID не учитываем при проверке завершённости текста.
     */
    const looksTruncatedCompare = (text, finishReason) => {
      const lines = (text || '').trim().split('\n');
      const lastLine = lines[lines.length - 1]?.trim() || '';
      const t =
        /^RECOMMENDED_PET_ID:\s*[a-fA-F0-9]{24}\s*$/i.test(lastLine)
          ? lines.slice(0, -1).join('\n').trim()
          : (text || '').trim();
      if (t.length < 40) return true;
      // Законченное предложение — считаем ответ целым (даже если API вернул MAX_TOKENS)
      if (/[.!?…]["»]?\s*$/u.test(t)) return false;
      if (finishReason === 'MAX_TOKENS') return true;
      const lastWord = (t.match(/\S+$/u) || [''])[0].toLowerCase();
      const incompleteLastWord =
        /^(более|менее|много|мало|очень|который|которая|которое|которые|будет|будут|может|могут|такой|такая|такое|чтобы|если|когда|хотя|однако|или|для|при|на|в|и|а|но|то|не)$/i.test(
          lastWord
        );
      if (incompleteLastWord) return true;
      if (/[,;:—–-]\s*$/u.test(t)) return true;
      // Длинный текст без финальной пунктуации — с большой вероятностью обрезан
      if (t.length > 120) return true;
      return false;
    };

    let lastText = '';
    const maxRetries = 3;
    const tokenLimits = [2048, 4096, 4096];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const result = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          temperature: 0.5,
          maxOutputTokens: tokenLimits[Math.min(attempt, tokenLimits.length - 1)],
          topP: 0.9
        }
      });

      const text = (result.text || '').trim();
      lastText = text;
      const finishReason = result.candidates?.[0]?.finishReason;

      if (!looksTruncatedCompare(text, finishReason)) {
        const parsed = splitRecommendationAndPetId(text, pets);
        return {
          recommendation: parsed.recommendation || 'Не удалось сформировать рекомендацию.',
          recommendedPetId: parsed.recommendedPetId
        };
      }

      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
      }
    }

    const parsedFinal = splitRecommendationAndPetId(lastText, pets);
    return {
      recommendation: parsedFinal.recommendation || 'Не удалось сформировать рекомендацию.',
      recommendedPetId: parsedFinal.recommendedPetId
    };
  } catch (error) {
    console.error('❌ Ошибка AI при сравнении:', error.message);
    return {
      recommendation: 'AI временно недоступен. Сравните питомцев по таблице ниже.',
      recommendedPetId: null
    };
  }
}

module.exports = {
  getAIRecommendations,
  getCompareRecommendation
};

