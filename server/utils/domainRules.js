/**
 * Чистые функции бизнес-правил серверной части (для юнит-тестов и переиспользования).
 */

/** Можно ли удалить приют (как в админ-панели: только при current_capacity === 0). */
function canDeleteShelter(currentCapacity) {
  const n = Number(currentCapacity) || 0;
  if (n > 0) {
    return {
      allowed: false,
      message: `Невозможно удалить приют: в нём находятся животные (${n}).`,
    };
  }
  return { allowed: true, message: null };
}

/** Есть ли свободное место в приюте. */
function hasShelterFreeSlot(currentCapacity, maxCapacity) {
  const current = Number(currentCapacity) || 0;
  const max = Number(maxCapacity) || 0;
  return current < max;
}

/** Безопасное уменьшение счётчика мест на 1 (не ниже 0). */
function safeDecrementCapacity(value) {
  return Math.max(0, (Number(value) || 0) - 1);
}

/**
 * Изменение занятости приюта при смене статуса питомца.
 * +1: переход на Approved из любого статуса, кроме Approved и InReview
 * -1: уход с Approved на любой статус, кроме Approved и InReview
 *  0: все остальные переходы
 */
function getShelterCapacityDelta(oldStatus, newStatus) {
  if (oldStatus === newStatus) return 0;

  if (newStatus === 'Approved' && oldStatus !== 'Approved' && oldStatus !== 'InReview') {
    return 1;
  }

  if (oldStatus === 'Approved' && newStatus !== 'Approved' && newStatus !== 'InReview') {
    return -1;
  }

  return 0;
}

/**
 * Валидация характеристик темперамента питомца (окончание на «ий»/«ый», без дубликатов).
 * Логика совпадает с проверкой при создании/редактировании питомца.
 */
function validateTemperamentTraits(traits) {
  if (!Array.isArray(traits)) return { valid: true, traits: [] };

  const seen = new Set();
  const uniqueTraits = [];

  for (const trait of traits) {
    if (!trait || typeof trait !== 'string') continue;

    let baseTrait = trait.trim();
    if (baseTrait.includes('(-')) {
      baseTrait = baseTrait.split('(-')[0].trim();
    }

    if (!baseTrait.endsWith('ий') && !baseTrait.endsWith('ый')) {
      return {
        valid: false,
        error: `Характеристика "${trait}" должна заканчиваться на "ий" или "ый" (например: дружелюбный, милый)`,
      };
    }

    const normalizedTrait = trait.toLowerCase();
    if (seen.has(normalizedTrait)) {
      return {
        valid: false,
        error: `Обнаружена повторяющаяся характеристика: "${trait}"`,
      };
    }

    seen.add(normalizedTrait);
    uniqueTraits.push(trait);
  }

  return { valid: true, traits: uniqueTraits };
}

/** Фильтрация списка заявок/записей по статусу (вкладки админ-панели). */
function filterByStatus(items, status, statusField = 'status') {
  if (!status || status === 'all') return items;
  return items.filter((item) => item[statusField] === status);
}

/** Выбор базового URL клиента из строки CLIENT_URLS (предпочтение https). */
function resolveClientBaseUrl(raw) {
  const urls = String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const httpsUrl = urls.find((u) => u.startsWith('https://'));
  return httpsUrl || urls[0] || 'http://localhost:3000';
}

module.exports = {
  canDeleteShelter,
  hasShelterFreeSlot,
  safeDecrementCapacity,
  getShelterCapacityDelta,
  validateTemperamentTraits,
  filterByStatus,
  resolveClientBaseUrl,
};
