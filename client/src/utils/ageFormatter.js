import { differenceInYears, differenceInMonths, differenceInDays } from 'date-fns';

/**
 * Вычисляет возраст на основе даты рождения
 * @param {string} birthDateString - Дата рождения в формате строки
 * @returns {Object|null} - Объект с информацией о возрасте или null, если дата невалидна
 */
export const calculateAge = (birthDateString) => {
  if (!birthDateString) return null;
  
  const birthDate = new Date(birthDateString);
  const today = new Date();
  
  // Проверка на валидность даты
  if (isNaN(birthDate.getTime())) return null;
  
  const years = differenceInYears(today, birthDate);
  
  if (years > 0) {
    // Если больше года, показываем возраст в годах
    return {
      value: years,
      unit: 'years'
    };
  }
  
  const months = differenceInMonths(today, birthDate);
  
  if (months > 0) {
    // Если больше месяца, показываем возраст в месяцах
    return {
      value: months,
      unit: 'months'
    };
  }
  
  // Если меньше месяца, показываем в днях
  const days = differenceInDays(today, birthDate);
  return {
    value: Math.max(days, 1), // Минимум 1 день
    unit: 'days'
  };
};

/**
 * Возвращает правильную форму слова "год" в зависимости от числа
 * @param {number} years - Количество лет
 * @returns {string} - Правильная форма слова "год/года/лет"
 */
export const getYearWord = (years) => {
  if (years % 10 === 1 && years % 100 !== 11) {
    return "год";
  } else if ([2, 3, 4].includes(years % 10) && ![12, 13, 14].includes(years % 100)) {
    return "года";
  } else {
    return "лет";
  }
};

/**
 * Возвращает правильную форму слова "месяц" в зависимости от числа
 * @param {number} months - Количество месяцев
 * @returns {string} - Правильная форма слова "месяц/месяца/месяцев"
 */
export const getMonthWord = (months) => {
  if (months % 10 === 1 && months % 100 !== 11) {
    return "месяц";
  } else if ([2, 3, 4].includes(months % 10) && ![12, 13, 14].includes(months % 100)) {
    return "месяца";
  } else {
    return "месяцев";
  }
};

/**
 * Возвращает правильную форму слова "день" в зависимости от числа
 * @param {number} days - Количество дней
 * @returns {string} - Правильная форма слова "день/дня/дней"
 */
export const getDayWord = (days) => {
  if (days % 10 === 1 && days % 100 !== 11) {
    return "день";
  } else if ([2, 3, 4].includes(days % 10) && ![12, 13, 14].includes(days % 100)) {
    return "дня";
  } else {
    return "дней";
  }
};

/**
 * Форматирует возраст с правильным склонением единиц измерения
 * @param {string} birthDateString - Дата рождения в формате строки
 * @returns {string} - Форматированная строка возраста
 */
export const formatAge = (birthDateString) => {
  const age = calculateAge(birthDateString);
  
  if (!age) return "Неизвестно";
  
  if (age.unit === 'years') {
    return `${age.value} ${getYearWord(age.value)}`;
  } else if (age.unit === 'months') {
    return `${age.value} ${getMonthWord(age.value)}`;
  } else {
    return `${age.value} ${getDayWord(age.value)}`;
  }
}; 