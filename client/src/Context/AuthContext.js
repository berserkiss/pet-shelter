import { createContext, useReducer, useEffect, useContext, useState, useCallback, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { getSocketServerUrl } from '../utils/socketServerUrl';

export const AuthContext = createContext();

export const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN':
      if (action.payload && action.payload.token) {
        console.log('LOGIN action с токеном:', action.payload.token);
        
        // Обновляем хранилище
        sessionStorage.setItem('token', action.payload.token);
        sessionStorage.setItem('user', JSON.stringify(action.payload));
        
        return { user: action.payload };
      }
      return { user: null };
      
    case 'LOGOUT':
      console.log('LOGOUT action: Очистка токена и данных пользователя');
      
      // Очищаем sessionStorage
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      
      return { user: null };
      
    case 'UPDATE_TOKEN':
      if (action.payload) {
        console.log('UPDATE_TOKEN action:', action.payload);
        
        // Сохраняем новый токен в sessionStorage
        sessionStorage.setItem('token', action.payload);
        
        // Обновляем токен в объекте пользователя, если он существует
        if (state.user) {
          const updatedUser = { ...state.user, token: action.payload };
          sessionStorage.setItem('user', JSON.stringify(updatedUser));
          return { user: updatedUser };
        }
        
        return state;
      }
      return state;
      
    default:
      return state;
  }
};

export const AuthContextProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, { user: null });
  const [isLoading, setIsLoading] = useState(false);
  const [isTokenRefreshing, setIsTokenRefreshing] = useState(false);
  const forceLogoutRef = useRef(null);

  const forceLogout = useCallback((redirectToAuth = false) => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    dispatch({ type: 'LOGOUT' });
    delete axios.defaults.headers.common['Authorization'];

    if (window.globalSocket) {
      window.globalSocket.disconnect();
      window.globalSocket = null;
    }

    const path = window.location.pathname;
    const isAuthPage = path.startsWith('/pawfinds/auth');
    const isAdminPage = path.startsWith('/pawfinds/admin');

    if (redirectToAuth && !isAuthPage && !isAdminPage) {
      window.location.href = '/pawfinds/auth';
    }
  }, []);

  forceLogoutRef.current = forceLogout;

  const isBlockedAuthError = (status, data) =>
    status === 403 && data?.error?.includes('заблокирован');

  // Setup axios default config and interceptors for token handling
  useEffect(() => {
    const setupAxiosDefaults = () => {
      const apiUrl = '/api';
      
      // Set axios defaults
      axios.defaults.withCredentials = true; // Always include cookies in requests
      
      // Remove existing interceptors if any
      const reqInterceptor = axios.interceptors.request.handlers?.[0]?.id;
      const resInterceptor = axios.interceptors.response.handlers?.[0]?.id;
      
      if (reqInterceptor) axios.interceptors.request.eject(reqInterceptor);
      if (resInterceptor) axios.interceptors.response.eject(resInterceptor);
      
      // Request interceptor to add token to all requests
      axios.interceptors.request.use(
        (config) => {
          // Всегда получаем самый свежий токен из sessionStorage при каждом запросе
          const token = sessionStorage.getItem('token');
          if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
          }
          return config;
        },
        (error) => Promise.reject(error)
      );

      // Response interceptor to handle token expiration
      axios.interceptors.response.use(
        (response) => response,
        async (error) => {
          const originalRequest = error.config;
          
          // Проверяем, что ошибка связана с истечением срока действия токена
          if (
            (error.response?.status === 401) && 
            (error.response?.data?.code === 'TOKEN_EXPIRED' || 
             error.response?.data?.error === 'Token expired' ||
             error.response?.data?.error === 'Invalid or expired token') && 
            !originalRequest._retry
          ) {
            
            originalRequest._retry = true;
            
            try {
              console.log("Токен истек, запрашиваем новый...");
              
              // Call the refresh token endpoint
              const response = await axios.post(`${apiUrl}/user/refresh-token`, {}, {
                withCredentials: true // Include cookies in the request
              });
              
              // If we get a new token, update it
              if (response.data && response.data.token) {
                const { token, userName, email, role, _id, hasPassword, authProvider } = response.data;
                console.log("Получены новые данные:", { token, userName, email, role, _id });
                
                // Создаем обновленный объект пользователя
                const updatedUser = { 
                  userName, 
                  email, 
                  token, 
                  role: role || (state.user ? state.user.role : 'user'),
                  _id,
                  hasPassword: hasPassword ?? state.user?.hasPassword,
                  authProvider: authProvider || state.user?.authProvider || 'local',
                };
                
                // Обновляем sessionStorage
                sessionStorage.setItem('token', token);
                sessionStorage.setItem('user', JSON.stringify(updatedUser));
                
                // Обновляем состояние
                dispatch({ type: 'LOGIN', payload: updatedUser });
                
                // Update the original request with the new token
                originalRequest.headers['Authorization'] = `Bearer ${token}`;
                console.log('Токен обновлен, повторяем запрос');
                
                // Retry request with new token
                return axios(originalRequest);
              }
            } catch (refreshError) {
              console.error('Error refreshing token:', refreshError);

              if (isBlockedAuthError(refreshError.response?.status, refreshError.response?.data)) {
                forceLogoutRef.current?.(true);
                return Promise.reject(refreshError);
              }
              
              // If refresh fails, log out the user
              sessionStorage.removeItem('token');
              sessionStorage.removeItem('user');
              dispatch({ type: 'LOGOUT' });
              
              return Promise.reject(refreshError);
            }
          }

          // Если пользователь заблокирован — немедленно выкинуть
          if (isBlockedAuthError(error.response?.status, error.response?.data)) {
            forceLogoutRef.current?.(true);
            return Promise.reject(error);
          }
          
          return Promise.reject(error);
        }
      );
    };
    
    setupAxiosDefaults();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Перехват fetch для блокировки и других auth-ошибок
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (...args) => {
      const response = await originalFetch(...args);

      if (response.status === 403) {
        try {
          const data = await response.clone().json();
          if (isBlockedAuthError(403, data)) {
            forceLogoutRef.current?.(true);
          }
        } catch (_) {
          // ignore non-json responses
        }
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  // Function to refresh token
  const refreshToken = async () => {
    // Добавляем проверку на isRefreshing, чтобы предотвратить множественные запросы
    if (isTokenRefreshing) {
      console.log('Токен уже обновляется, запрос пропущен');
      return;
    }
    
    // Устанавливаем флаг, что обновление токена начато
    setIsTokenRefreshing(true);
    
    try {
      console.log('Запрос на обновление токена...');
      const response = await axios.post('/api/user/refresh-token', {}, {
        withCredentials: true
      });
      
      if (response.data && response.data.token) {
        const { token, userName, email, role, hasPassword, authProvider } = response.data;
        
        // Create updated user object
        const updatedUser = { 
          userName, 
          email, 
          token, 
          role: role || (state.user ? state.user.role : 'user'),
          _id: response.data._id || (state.user ? state.user._id : null),
          hasPassword: hasPassword ?? state.user?.hasPassword,
          authProvider: authProvider || state.user?.authProvider || 'local',
        };
        
        // Update sessionStorage
        sessionStorage.setItem('user', JSON.stringify(updatedUser));
        sessionStorage.setItem('token', token);
        
        // Update auth context
        dispatch({ type: 'LOGIN', payload: updatedUser });
        
        // Set axios default header
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        console.log('Токен успешно обновлен', token ? token.substring(0, 10) + '...' : '');
      }
    } catch (error) {
      console.error('Ошибка обновления токена:', error);
      
      // If the refresh token is invalid, logout user
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        if (isBlockedAuthError(error.response.status, error.response.data)) {
          forceLogout(true);
          return;
        }
        console.log('Refresh token invalid, logging out');
        forceLogout(false);
      }
    } finally {
      // Независимо от результата, сбрасываем флаг
      setTimeout(() => {
        setIsTokenRefreshing(false);
      }, 3000); // Добавляем задержку 3 секунды перед следующим возможным обновлением
    }
  };

  // Effect to load user data
  useEffect(() => {
    // Load user from sessionStorage
    const loadUser = () => {
      const user = JSON.parse(sessionStorage.getItem('user'));
      const token = sessionStorage.getItem('token');

      if (user && token) {
        dispatch({ type: 'LOGIN', payload: user });
        // Устанавливаем заголовок авторизации напрямую
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        return true;
      }
      return false;
    };
    
    // Загружаем пользователя при первом рендере
    loadUser();
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set up axios interceptors for token handling
  const setupAxiosInterceptors = () => {
    axios.interceptors.request.use(
      (config) => {
        const token = sessionStorage.getItem('token');
        if (token) {
          config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        // Проверяем, не запрос ли это на обновление токена
        const isRefreshRequest = error.config.url?.includes('/refresh-token');
        
        if (error.response && error.response.status === 401 && !isRefreshRequest && !isTokenRefreshing) {
          console.log('401 response intercepted, refreshing token');
          
          try {
            await refreshToken();
            
            // Если токен успешно обновлен, повторяем исходный запрос
            const token = sessionStorage.getItem('token');
            if (token) {
              error.config.headers['Authorization'] = `Bearer ${token}`;
              return axios(error.config);
            }
          } catch (refreshError) {
            console.error('Failed to refresh token in interceptor:', refreshError);
            if (isBlockedAuthError(refreshError.response?.status, refreshError.response?.data)) {
              forceLogout(true);
            } else {
              forceLogout(false);
            }
          }
        }

        if (isBlockedAuthError(error.response?.status, error.response?.data)) {
          forceLogout(true);
        }
        
        return Promise.reject(error);
      }
    );
  };

  // Setup token refresh interval
  const setupTokenRefresh = () => {
    // Очищаем предыдущий интервал, если он был
    if (window.tokenRefreshInterval) {
      clearInterval(window.tokenRefreshInterval);
    }
    
    // Устанавливаем интервал обновления токена - каждые 110 минут (6600000 мс)
    // Это предотвращает истечение срока действия 2-часового токена
    window.tokenRefreshInterval = setInterval(() => {
      const user = JSON.parse(sessionStorage.getItem('user'));
      if (user && !isTokenRefreshing) {
        console.log('Scheduled token refresh');
        refreshToken();
      }
    }, 6600000); // 110 минут
    
    // Также обновляем токен при активности пользователя, но не чаще чем раз в 60 минут
    let lastRefresh = Date.now();
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    const handleUserActivity = () => {
      const user = JSON.parse(sessionStorage.getItem('user'));
      const now = Date.now();
      
      if (user && !isTokenRefreshing && (now - lastRefresh > 3600000)) {  // 60 минут
        console.log('User activity detected, refreshing token');
        lastRefresh = now;
        refreshToken();
      }
    };
    
    // Удаляем предыдущие обработчики, если они были
    activityEvents.forEach(event => {
      window.removeEventListener(event, handleUserActivity);
    });
    
    // Добавляем обработчики событий
    activityEvents.forEach(event => {
      window.addEventListener(event, handleUserActivity);
    });
    
    // Функция очистки
    return () => {
      if (window.tokenRefreshInterval) {
        clearInterval(window.tokenRefreshInterval);
      }
      
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
    };
  };

  // useEffect for initialization after component mount
  useEffect(() => {
    // Load user from sessionStorage
    const loadUser = () => {
      const user = JSON.parse(sessionStorage.getItem('user'));
      const token = sessionStorage.getItem('token');

      if (user && token) {
        dispatch({ type: 'LOGIN', payload: user });
        // Устанавливаем заголовок авторизации напрямую
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        return true;
      }
      return false;
    };
    
    // Load user from sessionStorage
    loadUser();
    
    // Setup axios interceptors
    setupAxiosInterceptors();
    
    // Setup token refresh mechanism
    const cleanupTokenRefresh = setupTokenRefresh();
    
    // Cleanup function
    return () => {
      cleanupTokenRefresh();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get socket connection with auth token
  const getSocket = () => {
    // Проверка на существующее подключение
    if (window.globalSocket && window.globalSocket.connected) {
      console.log('Используется существующее socket-подключение');
      return window.globalSocket;
    }
    
    // Очистка существующего подключения, если оно есть
    if (window.globalSocket) {
      console.log('Закрытие существующего socket-подключения');
      window.globalSocket.disconnect();
    }
    
    const token = sessionStorage.getItem('token');
    
    if (!token) {
      console.log('Нет токена для socket-подключения');
      return null;
    }
    
    console.log('Создание нового socket-подключения');
    const socket = io(getSocketServerUrl(), {
      path: '/socket.io',
      auth: {
        token
      }
    });
    
    // Сохраняем socket в глобальной переменной для повторного использования
    window.globalSocket = socket;
    
    // Обработка событий сокета
    socket.on('connect', () => {
      console.log('Socket connected with ID:', socket.id);
    });

    if (!socket.__blockedListenerAttached) {
      socket.on('userBlocked', () => {
        forceLogoutRef.current?.(true);
      });
      socket.__blockedListenerAttached = true;
    }
    
    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected, reason:', reason);
    });
    
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
    
    socket.on('tokenExpired', async () => {
      console.log('Socket event: Token expired, refreshing...');
      await refreshToken();
      
      // Переподключение сокета с новым токеном
      if (socket.disconnected) {
        const newToken = sessionStorage.getItem('token');
        if (newToken) {
          socket.auth = { token: newToken };
          socket.connect();
        }
      }
    });
    
    return socket;
  };

  useEffect(() => {
    if (state.user?.token) {
      getSocket();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.user?.token]);

  return (
    <AuthContext.Provider value={{ 
      user: state.user, 
      dispatch, 
      refreshToken,
      isLoading,
      getSocket,
      forceLogout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Экспортируем хук для удобного использования контекста
export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw Error('useAuthContext must be used inside an AuthContextProvider');
  }
  return context;
};
