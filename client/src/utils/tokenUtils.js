// Утилита для замены прямого использования sessionStorage и refresh-token в компонентах
// Все компоненты должны использовать AuthContext вместо прямых вызовов

import { useAuthContext } from '../hooks/UseAuthContext';

// Хук для получения токена из AuthContext
export const useToken = () => {
  const { user } = useAuthContext();
  return user?.token || null;
};

// Хук для обновления токена через AuthContext
export const useRefreshToken = () => {
  const { refreshToken } = useAuthContext();
  return refreshToken;
};

// Функция для показа предупреждения о deprecated API
export const showDeprecationWarning = (functionName) => {
  console.warn(`[DEPRECATED] ${functionName} не следует использовать напрямую. Используйте AuthContext для управления токенами.`);
};

// Deprecated functions - показывают предупреждения
export const deprecatedSessionStorage = {
  setItem: (key, value) => {
    showDeprecationWarning('sessionStorage.setItem');
    // Не выполняем операцию, только предупреждаем
  },
  getItem: (key) => {
    showDeprecationWarning('sessionStorage.getItem');
    return null;
  },
  removeItem: (key) => {
    showDeprecationWarning('sessionStorage.removeItem');
  }
};

export const deprecatedRefreshToken = async () => {
  showDeprecationWarning('прямой вызов refresh-token API');
  throw new Error('Используйте refreshToken из AuthContext');
}; 