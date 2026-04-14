import { useAuthContext } from "./UseAuthContext";
import axios from "axios";

export const useLogout = () => {
  const { dispatch } = useAuthContext();

  const logout = async () => {
    try {
      // Отправляем запрос на сервер для отзыва токенов
      await axios.post('/api/user/logout', {}, {
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('token')}`
        },
        withCredentials: true
      });
      
      // Удаляем данные пользователя из sessionStorage вместо localStorage
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('token');
      
      // Обновляем состояние React
      dispatch({ type: 'LOGOUT' });
      
    } catch (error) {
      console.error('Logout error:', error);
      
      // Даже если запрос не удался, очищаем локальное хранилище и состояние
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('token');
      dispatch({ type: 'LOGOUT' });
    }
  };

  return { logout };
};
