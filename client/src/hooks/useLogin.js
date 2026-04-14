import { useState } from 'react';
import { useAuthContext } from './UseAuthContext';
import axios from 'axios';

export const useLogin = () => {
  const { dispatch } = useAuthContext();
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(null);
  
  const login = async (email, password) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.post('/api/user/login', { email, password }, {
        withCredentials: true
      });
      
      // Сохраняем данные пользователя в sessionStorage вместо localStorage
      sessionStorage.setItem('user', JSON.stringify(response.data));
      sessionStorage.setItem('token', response.data.token);
      
      // Обновляем состояние React
      dispatch({ type: 'LOGIN', payload: response.data });
      
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      setError(error.response?.data?.error || 'Ошибка сервера');
      throw error; // Пробрасываем ошибку дальше для обработки в компоненте
    }
  };
  
  return { login, isLoading, error };
};
