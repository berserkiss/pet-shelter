import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import PetsViewer from "./PetsViewer";
import PetFilter from "./PetFilter";
import RecommendedPets from "./RecommendedPets";
import ComparePets from "./ComparePets";
import AIChat from "../AIChat/AIChat";
import { useAuthContext } from "../../hooks/UseAuthContext";
import { usePetFilters } from "../../hooks/usePetFilters";
import io from 'socket.io-client';
import axios from 'axios';
import { getSocketServerUrl } from '../../utils/socketServerUrl';
import "./Pets.css";

// SVG icon for header
const DogIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.703 1.725 1.722 3.656 1 1.261-.472 1.96-1.45 2.344-2.5"></path>
    <path d="M14.267 5.172c0-1.39 1.577-2.493 3.5-2.172 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5"></path>
    <path d="M8 14v.5"></path>
    <path d="M16 14v.5"></path>
    <path d="M11.25 16.25h1.5L12 17l-.75-.75z"></path>
    <path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444c0-1.061-.162-2.2-.493-3.309m-9.243-6.082A8.801 8.801 0 0 1 12 5c.78 0 1.5.108 2.161.306"></path>
  </svg>
);

const Pets = () => {
  const [petsData, setPetsData] = useState([]);
  const [shelters, setShelters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationError, setRecommendationError] = useState(null);
  const [hasPreferences, setHasPreferences] = useState(false);
  const [aiPowered, setAiPowered] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalReason, setAuthModalReason] = useState(null); // null | 'compare' | 'default'
  const [showCompareWelcomeModal, setShowCompareWelcomeModal] = useState(false);
  const { user, dispatch } = useAuthContext();
  const socketRef = useRef();
  const petCatalogRef = useRef(null);
  const loadRecommendationsRef = useRef(null);

  const { filters, handleFilterChange, filterPets } = usePetFilters();

  // Инициализация WebSocket соединения
  useEffect(() => {
    // Подключаемся к сокет-серверу
    const socket = io(getSocketServerUrl(), {
      path: '/socket.io',
      auth: {
        token: user && user.token ? user.token : undefined
      }
    });
    
    socketRef.current = socket;
    
    // Обработка ошибок соединения
    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
    });

    socket.on('connect', () => {
      if (user?._id) socket.emit('joinRoom', `userId:${user._id}`);
    });
    
    // Listen for token expiration
    socket.on('tokenExpired', async () => {
      console.log('Received token expired event from server, refreshing token...');
      try {
        const response = await axios.post('/api/user/refresh-token', {}, {
          withCredentials: true
        });
        
        if (response.data && response.data.token) {
          const { token, userName, email, role } = response.data;
          
          // Update user object with new token
          const updatedUser = { 
            userName, 
            email, 
            token, 
            role: role || (user ? user.role : 'user')
          };
          
          // Update sessionStorage
          sessionStorage.setItem('user', JSON.stringify(updatedUser));
          sessionStorage.setItem('token', token);
          
          // Update auth context
          dispatch({ type: 'LOGIN', payload: updatedUser });
          
          // Reconnect socket with new token
          socket.disconnect();
          socket.auth = { token };
          socket.connect();
          
          console.log('Token refreshed, socket reconnected');
        }
      } catch (error) {
        console.error('Failed to refresh token from socket event:', error);
      }
    });
    
    // Слушаем обновления статуса питомцев
    socket.on('petRequestUpdate', (updatedPet) => {
      // Если статус изменился на "Approved", добавляем питомца в список
      if (updatedPet.status === 'Approved') {
        setPetsData(prevPets => {
          // Проверяем, есть ли уже такой питомец в списке
          const existingPetIndex = prevPets.findIndex(pet => pet._id === updatedPet._id);
          
          if (existingPetIndex >= 0) {
            // Если питомец уже есть, обновляем его данные
            const updatedPets = [...prevPets];
            updatedPets[existingPetIndex] = updatedPet;
            return updatedPets;
          } else {
            // Если питомца нет, добавляем его в список
            setNotification(`Новый питомец ${updatedPet.name} доступен для усыновления!`);
            setTimeout(() => setNotification(null), 5000);
            return [...prevPets, updatedPet];
          }
        });
      }
    });
    
    // Слушаем удаление питомцев
    socket.on('petDeleted', ({ id }) => {
      setPetsData(prevPets => prevPets.filter(pet => pet._id !== id));
    });
    
    // Слушаем обновления приютов для обновления списка городов
    socket.on('shelterUpdate', (updatedShelter) => {
      console.log('Received shelter update in Pets component:', updatedShelter);
      setShelters(prevShelters => {
        const existingIndex = prevShelters.findIndex(shelter => shelter._id === updatedShelter._id);
        
        if (existingIndex >= 0) {
          // Обновляем существующий приют
          const updatedShelters = [...prevShelters];
          updatedShelters[existingIndex] = updatedShelter;
          return updatedShelters;
        } else {
          // Добавляем новый приют
          return [...prevShelters, updatedShelter];
        }
      });
    });

    // Слушаем удаление приютов
    socket.on('shelterDeleted', ({ id }) => {
      console.log('Received shelter deletion in Pets component:', id);
      setShelters(prevShelters => prevShelters.filter(shelter => shelter._id !== id));
    });

    // Обновляем рекомендации при изменении предпочтений (чат, профиль и т.д.)
    const handlePrefsUpdated = () => {
      loadRecommendationsRef.current?.();
    };
    socket.on('userPreferencesUpdated', handlePrefsUpdated);

    // Очистка при размонтировании
    return () => {
      socket.off('userPreferencesUpdated', handlePrefsUpdated);
      if (socket) {
        socket.disconnect();
      }
    };
  }, [user, dispatch]);

  // Обогащаем данные животных информацией о городе приюта
  const petsWithShelterInfo = useMemo(() => {
    return petsData.map(pet => {
      // Проверяем, есть ли у питомца привязка к приюту
      if (!pet.shelter_id) {
        return { ...pet, shelterCity: null };
      }
      
      // Ищем информацию о приюте
      const shelter = shelters.find(s => s._id === pet.shelter_id);
      
      return {
        ...pet,
        // Добавляем город приюта, если приют найден и имеет поле city
        shelterCity: shelter && shelter.city ? shelter.city : null
      };
    });
  }, [petsData, shelters]);

  // Теперь фильтруем с учетом города приюта
  const filteredPets = useMemo(() => {
    const result = filterPets(petsWithShelterInfo);
    console.log('Filtered pets count:', result.length);
    console.log('Current filters:', filters);
    return result;
  }, [filterPets, petsWithShelterInfo, filters]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sheltersResponse, petsResponse] = await Promise.all([
          fetch('/api/shelters', {
            headers: user && user.token ? { 'Authorization': `Bearer ${user.token}` } : {}
          }),
          fetch('/api/pets/approvedPets', {
            headers: user && user.token ? { 'Authorization': `Bearer ${user.token}` } : {}
          })
        ]);

        // Handle potential token expiration
        if (sheltersResponse.status === 401 || petsResponse.status === 401) {
          if (user && user.token) {
            try {
              console.log('Token expired during data fetch, attempting to refresh...');
              const refreshResponse = await axios.post('/api/user/refresh-token', {}, {
                withCredentials: true
              });
              
              if (refreshResponse.data && refreshResponse.data.token) {
                const { token, userName, email, role } = refreshResponse.data;
                
                // Update user object with new token
                const updatedUser = { 
                  userName, 
                  email, 
                  token, 
                  role: role || (user ? user.role : 'user')
                };
                
                // Update sessionStorage
                sessionStorage.setItem('user', JSON.stringify(updatedUser));
                sessionStorage.setItem('token', token);
                
                // Update auth context
                dispatch({ type: 'LOGIN', payload: updatedUser });
                
                // Try fetching data again with new token
                console.log('Token refreshed, retrying data fetch...');
                fetchData();
                return;
              }
            } catch (refreshError) {
              console.error('Failed to refresh token:', refreshError);
            }
          }
        }

        const [sheltersData, petsData] = await Promise.all([
          sheltersResponse.ok ? sheltersResponse.json() : [],
          petsResponse.ok ? petsResponse.json() : []
        ]);

        // Убеждаемся, что отображаются только питомцы со статусом "Approved"
        // (не "Adopted", не "Pending" и т.д.)
        const approvedPets = Array.isArray(petsData) 
          ? petsData.filter(pet => pet.status === 'Approved')
          : [];

        setShelters(Array.isArray(sheltersData) ? sheltersData : []);
        setPetsData(approvedPets);
        setError(null);
      } catch (error) {
        console.error(error);
        setError('Ошибка при загрузке данных');
        setShelters([]);
        setPetsData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, dispatch]);

  // Функция загрузки рекомендаций (вынесена из useEffect для использования в AIChat)
  const loadRecommendations = useCallback(async (allowRefresh = true) => {
    if (!user || !user.token) {
      setRecommendations([]);
      setHasPreferences(false);
      setRecommendationError(null);
      return;
    }

    setRecommendationsLoading(true);
    setRecommendationError(null);
    try {
      const response = await fetch('/api/recommendations/pets?limit=9', {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });

      if (response.status === 401 && allowRefresh) {
        try {
          console.log('Token expired during recommendations fetch, attempting to refresh...');
          const refreshResponse = await axios.post('/api/user/refresh-token', {}, {
            withCredentials: true
          });

          if (refreshResponse.data && refreshResponse.data.token) {
            const { token, userName, email, role } = refreshResponse.data;

            const updatedUser = {
              userName,
              email,
              token,
              role: role || (user ? user.role : 'user')
            };

            sessionStorage.setItem('user', JSON.stringify(updatedUser));
            sessionStorage.setItem('token', token);
            dispatch({ type: 'LOGIN', payload: updatedUser });

            return loadRecommendations(false);
          }
        } catch (refreshError) {
          console.error('Failed to refresh token while loading recommendations:', refreshError);
        }
      }

      if (!response.ok) {
        throw new Error('Failed to fetch recommendations');
      }

      const data = await response.json();

      setHasPreferences(Boolean(data.hasPreferences));
      setRecommendations(Array.isArray(data.recommendations) ? data.recommendations : []);
      setAiPowered(Boolean(data.aiPowered));
      setRecommendationError(null);
    } catch (err) {
      console.error('Error fetching recommendations:', err);
      setRecommendationError('Не удалось загрузить рекомендации. Попробуйте позже.');
    } finally {
      setRecommendationsLoading(false);
    }
  }, [user, dispatch]);

  loadRecommendationsRef.current = loadRecommendations;

  // Подборка из чата — без повторного AI-запроса на /recommendations
  const applyChatRecommendations = useCallback((suggestedPets) => {
    const mapped = (suggestedPets || []).map((p) => ({
      pet: p,
      matchPercentage: p.matchScore ?? p.matchPercentage ?? 0,
      matchedTraits: p.matchedTraits || [],
      aiReasoning: p.aiReasoning || ''
    }));
    setRecommendations(mapped);
    setAiPowered(true);
    setHasPreferences(true);
    setRecommendationError(null);
  }, []);

  // Загружаем рекомендации при монтировании и изменении пользователя
  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  // Модалка «Сравнить избранных» при переходе на страницу Pets (и для гостей)
  useEffect(() => {
    const t = setTimeout(() => setShowCompareWelcomeModal(true), 400);
    return () => clearTimeout(t);
  }, []);

  const scrollToCompare = () => {
    setShowCompareWelcomeModal(false);
    if (!user?.token) {
      setAuthModalReason('compare');
      setShowAuthModal(true);
      return;
    }
    document.getElementById('compare-pets-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="pets-container">
      {notification && (
        <div className="notification-banner">
          <div className="notification-content">
            <span className="notification-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            {notification}
            <button onClick={() => setNotification(null)} className="notification-close">×</button>
          </div>
        </div>
      )}
      
      <div className="pets-header">
        <div className="header-icon">
          <DogIcon />
        </div>
        <h1>Питомцы для усыновления</h1>
        <p className="header-description">
          Здесь представлены животные, которые ищут любящий дом. Найдите своего нового друга, который станет частью вашей семьи.
        </p>
        <a
          href="#compare-pets-section"
          className="pets-header-compare-link"
          onClick={(e) => {
            e.preventDefault();
            if (!user?.token) {
              setAuthModalReason('compare');
              setShowAuthModal(true);
              return;
            }
            document.getElementById('compare-pets-section')?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          Сравнить избранных
        </a>
      </div>
      
      <PetFilter
        pets={petsData}
        shelters={shelters}
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      {/* Рекомендации - всегда показываем */}
      <RecommendedPets
        recommendations={user ? recommendations : []}
        shelters={shelters}
        loading={user ? recommendationsLoading : false}
        error={user ? recommendationError : null}
        hasPreferences={user ? hasPreferences : false}
        aiPowered={user ? aiPowered : false}
        isGuest={!user}
        onGuestClick={() => { setAuthModalReason('default'); setShowAuthModal(true); }}
      />

      {/* Сравнение избранных питомцев (для авторизованных; при <2 — модалка + CTA) */}
      <ComparePets
        isGuest={!user}
        onGuestClick={() => { setAuthModalReason('compare'); setShowAuthModal(true); }}
        scrollToPets={() => petCatalogRef.current?.scrollIntoView({ behavior: 'smooth' })}
      />

      <div className="pet-container" id="pet-catalog" ref={petCatalogRef}>
        {loading ? (
          <p>Загрузка...</p>
        ) : error ? (
          <p className="error-message">{error}</p>
        ) : filteredPets.length > 0 ? (
          filteredPets.map((pet, index) => {
            const shelter = shelters.find(s => s._id === pet.shelter_id);
            const shelterAddress = shelter
              ? `${shelter.city}, ${shelter.street}, ${shelter.house}`
              : "—";
            return (
              <PetsViewer
                key={pet._id || index}
                pet={pet}
                shelter={shelter}
                shelterAddress={shelterAddress}
              />
            );
          })
        ) : (
          <div className="oops-msg">
            <div style={{ marginBottom: '15px' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.703 1.725 1.722 3.656 1 1.261-.472 1.96-1.45 2.344-2.5" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14.267 5.172c0-1.39 1.577-2.493 3.5-2.172 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 14v.5M16 14v.5M11.25 16.25h1.5L12 17l-.75-.75z" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444c0-1.061-.162-2.2-.493-3.309m-9.243-6.082A8.801 8.801 0 0 1 12 5c.78 0 1.5.108 2.161.306" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>Питомцы не найдены по вашим фильтрам</div>
            <div style={{ fontSize: '1rem', marginTop: '10px', fontWeight: '400', color: '#6b7280' }}>
              Попробуйте изменить критерии поиска
            </div>
          </div>
        )}
      </div>

      {/* AI Chat Assistant - всегда показываем */}
      <AIChat 
        onPreferencesUpdated={loadRecommendations}
        onChatRecommendations={applyChatRecommendations}
        isGuest={!user}
        onGuestClick={() => {
          setAuthModalReason('default');
          setShowAuthModal(true);
        }}
      />

      {/* Боковая панель «Сравнить избранных» (как AI-чат) */}
      {showCompareWelcomeModal && (
        <div className="compare-welcome-panel">
          <button className="compare-welcome-close" onClick={() => setShowCompareWelcomeModal(false)} title="Закрыть">×</button>
          <div className="compare-welcome-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.703 1.725 1.722 3.656 1 1.261-.472 1.96-1.45 2.344-2.5" stroke="#6504b5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14.267 5.172c0-1.39 1.577-2.493 3.5-2.172 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5" stroke="#6504b5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 14v.5M16 14v.5M11.25 16.25h1.5L12 17l-.75-.75z" stroke="#6504b5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444c0-1.061-.162-2.2-.493-3.309m-9.243-6.082A8.801 8.801 0 0 1 12 5c.78 0 1.5.108 2.161.306" stroke="#6504b5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3>Сравните избранных питомцев</h3>
          <p>Выберите 2–4 питомца из избранного, сравните их по характеристикам и получите AI-рекомендацию.</p>
          <button className="compare-welcome-btn" onClick={scrollToCompare}>
            Перейти к сравнению
          </button>
        </div>
      )}

      {/* Модальное окно для незарегистрированных пользователей */}
      {showAuthModal && (
        <div className="auth-modal-overlay" onClick={() => { setShowAuthModal(false); setAuthModalReason(null); }}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <button className="auth-modal-close" onClick={() => { setShowAuthModal(false); setAuthModalReason(null); }}>×</button>
            <div className="auth-modal-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="#6504b5" strokeWidth="2"/>
                <path d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11" stroke="#6504b5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="16" r="1.5" fill="#6504b5"/>
              </svg>
            </div>
            <h2>Требуется авторизация</h2>
            {authModalReason === 'compare' ? (
              <>
                <p>Чтобы сравнивать питомцев из избранного и получать AI-рекомендацию, войдите в аккаунт.</p>
                <p>После входа добавляйте понравившихся питомцев в избранное и откройте блок «Сравнение избранных».</p>
              </>
            ) : (
              <>
                <p>Для того, чтобы проявить интерес к этому питомцу, необходимо войти в систему.</p>
                <p>Пожалуйста, войдите или создайте аккаунт для продолжения.</p>
              </>
            )}
            <div className="auth-modal-buttons">
              <a href="/pawfinds/auth" className="auth-modal-btn auth-modal-btn-primary">Войти / Зарегистрироваться</a>
              <button className="auth-modal-btn auth-modal-btn-secondary" onClick={() => { setShowAuthModal(false); setAuthModalReason(null); }}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Pets;