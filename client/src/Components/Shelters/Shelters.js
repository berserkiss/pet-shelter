import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuthContext } from "../../hooks/UseAuthContext";
import { useAuthModal } from "../../Context/AuthModalContext";
import io from 'socket.io-client';
import axios from 'axios';
import { getSocketServerUrl } from '../../utils/socketServerUrl';
import "./Shelters.css";
import StyledSelect from "../UI/StyledSelect";
import VolunteerForm from "./VolunteerForm";
import DonationModal from "./DonationModal";

// SVG иконки
const LocationIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
    <circle cx="12" cy="10" r="3"></circle>
  </svg>
);

const PhoneIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
  </svg>
);

const EmailIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
    <polyline points="22,6 12,13 2,6"></polyline>
  </svg>
);

const ClockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);

const InfoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="16" x2="12" y2="12"></line>
    <line x1="12" y1="8" x2="12.01" y2="8"></line>
  </svg>
);

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

const FilterIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
  </svg>
);

const VolunteerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);

const HeartIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
  </svg>
);

const Shelters = () => {
  const [searchParams] = useSearchParams();
  const [shelters, setShelters] = useState([]);
  const [filteredShelters, setFilteredShelters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  const { user, dispatch } = useAuthContext();
  const { showAuthModal } = useAuthModal();
  const socketRef = useRef();

  // AI Assistant state
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const aiChatEndRef = useRef(null);
  
  // Состояния для фильтров
  const [cities, setCities] = useState([]);
  const [filters, setFilters] = useState({
    city: "",
    capacityRange: [0, 100]
  });
  
  // Состояние для формы волонтера
  const [showVolunteerForm, setShowVolunteerForm] = useState(false);
  const [selectedShelter, setSelectedShelter] = useState(null);
  const [showVolunteerSuccess, setShowVolunteerSuccess] = useState(false);
  const [applicationError, setApplicationError] = useState(null);
  
  // Состояние для пожертвований
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [donationStats, setDonationStats] = useState({}); // {shelterId: {totalAmount, donationCount}}

  // Функция для применения фильтров - обернутая в useCallback
  const applyFilters = useCallback(() => {
    const filtered = shelters.filter(shelter => {
      // Фильтр по городу
      if (filters.city && shelter.city !== filters.city) {
        return false;
      }
      
      // Фильтр по заполненности
      const capacityPercentage = Math.round((shelter.current_capacity / shelter.max_capacity) * 100);
      if (capacityPercentage < filters.capacityRange[0] || capacityPercentage > filters.capacityRange[1]) {
        return false;
      }
      
      return true;
    });
    
    setFilteredShelters(filtered);
  }, [filters, shelters]); // Зависимости для useCallback

  // Применяем фильтры при изменении shelters или filters
  useEffect(() => {
    if (shelters.length > 0) {
      applyFilters();
    }
  }, [shelters, filters, applyFilters]);

  // Прокрутка к приюту из ссылки (например, со страницы сравнения избранного)
  useEffect(() => {
    const sid = searchParams.get("shelter");
    if (!sid || loading) return;
    const t = setTimeout(() => {
      const el = document.getElementById(`shelter-${sid}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 400);
    return () => clearTimeout(t);
  }, [searchParams, loading, filteredShelters]);

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
    
    // Явно присоединяемся к комнате shelters
    socket.emit('joinRoom', 'shelters');
    
    // Обработка ошибок соединения
    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
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
    
    // Отладочный обработчик для всех событий
    socket.onAny((event, ...args) => {
      console.log(`[WebSocket Debug] Event: ${event}`, args);
    });
    
    // Слушаем обновления приютов
    socket.on('shelterUpdate', (updatedShelter) => {
      console.log('Received shelter update:', updatedShelter);
      
      setShelters(prevShelters => {
        // Проверяем, есть ли уже такой приют в списке
        const existingIndex = prevShelters.findIndex(shelter => shelter._id === updatedShelter._id);
        
        if (existingIndex >= 0) {
          // Сохраняем текущее значение petCount
          const currentPetCount = prevShelters[existingIndex].petCount || 0;
          
          // Обновляем существующий приют
          const updatedShelters = [...prevShelters];
          updatedShelters[existingIndex] = {
            ...updatedShelter,
            petCount: currentPetCount  // Сохраняем существующее значение petCount
          };
          
          setNotification(`Информация о приюте "${updatedShelter.name}" обновлена`);
          setTimeout(() => setNotification(null), 5000);
          
          return updatedShelters;
        } else {
          // Добавляем новый приют
          setNotification(`Новый приют "${updatedShelter.name}" добавлен в систему`);
          setTimeout(() => setNotification(null), 5000);
          
          // Возвращаем обновленный список приютов с новым приютом
          return [...prevShelters, {...updatedShelter, petCount: 0}];
        }
      });
    });
    
    // Слушаем удаление приютов
    socket.on('shelterDeleted', ({ id, name }) => {
      console.log('Received shelter deletion:', id);
      
      setShelters(prevShelters => {
        const deletedShelter = prevShelters.find(shelter => shelter._id === id);
        const shelterName = name || (deletedShelter ? deletedShelter.name : 'Без названия');
        
        setNotification(`Приют "${shelterName}" удален из системы`);
        setTimeout(() => setNotification(null), 5000);
        
        return prevShelters.filter(shelter => shelter._id !== id);
      });
    });
    
    // Очистка при размонтировании
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [user, dispatch]); // Зависимость только от user

  // Отдельный эффект для обновления городов при изменении приютов
  useEffect(() => {
    // Извлекаем уникальные города из списка приютов
    const uniqueCities = [...new Set(shelters.map(shelter => shelter.city))];
    setCities(uniqueCities);
  }, [shelters]);

  useEffect(() => {
    const fetchShelters = async () => {
      try {
        console.log("Fetching shelters...");
        const response = await fetch('/api/shelters', {
          headers: user && user.token ? { 'Authorization': `Bearer ${user.token}` } : {}
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Shelters data:", data);
        
        if (Array.isArray(data)) {
          // Получаем информацию о питомцах для подсчета их количества в каждом приюте
          const petsResponse = await fetch('/api/pets/approvedPets', {
            headers: user && user.token ? { 'Authorization': `Bearer ${user.token}` } : {}
          });
          
          let petsData = [];
          if (petsResponse.ok) {
            petsData = await petsResponse.json();
          }
          
          // Обогащаем данные о приютах информацией о количестве животных в них
          const enrichedShelters = data.map(shelter => {
            const petsInShelter = petsData.filter(pet => pet.shelter_id === shelter._id).length;
            return {
              ...shelter,
              petCount: petsInShelter
            };
          });
          
          setShelters(enrichedShelters);
          setFilteredShelters(enrichedShelters);
          
          // Извлекаем уникальные города для фильтра
          const uniqueCities = [...new Set(enrichedShelters.map(shelter => shelter.city))];
          setCities(uniqueCities);
          
          // Загружаем статистику пожертвований для всех приютов
          enrichedShelters.forEach(shelter => {
            fetchDonationStats(shelter._id);
          });
        } else {
          console.error("Received non-array data:", data);
          setShelters([]);
          setFilteredShelters([]);
        }
        
        setError(null);
      } catch (error) {
        console.error("Error fetching shelters:", error);
        setError(error.message);
        setShelters([]);
        setFilteredShelters([]);
      } finally {
        setLoading(false);
      }
    };

    fetchShelters();

    // Подписка на WebSocket события для обновления приютов
    const socket = io(getSocketServerUrl(), {
      path: '/socket.io',
      auth: {
        token: user && user.token ? user.token : undefined
      }
    });

    // Слушаем обновления приютов
    socket.on('shelterUpdate', (updatedShelter) => {
      console.log('Received shelter update:', updatedShelter);
      setShelters(prevShelters => {
        const existingIndex = prevShelters.findIndex(shelter => shelter._id === updatedShelter._id);
        
        if (existingIndex >= 0) {
          // Обновляем существующий приют
          const updatedShelters = [...prevShelters];
          updatedShelters[existingIndex] = { ...updatedShelter, petCount: updatedShelters[existingIndex].petCount || 0 };
          return updatedShelters;
        } else {
          // Добавляем новый приют
          return [...prevShelters, { ...updatedShelter, petCount: 0 }];
        }
      });
    });

    // Слушаем удаление приютов
    socket.on('shelterDeleted', ({ id }) => {
      console.log('Received shelter deletion:', id);
      setShelters(prevShelters => prevShelters.filter(shelter => shelter._id !== id));
    });

    // Слушаем новые пожертвования
    socket.on('newDonation', ({ shelter_id }) => {
      console.log('Received new donation for shelter:', shelter_id);
      // Обновляем статистику пожертвований для приюта
      fetchDonationStats(shelter_id);
    });

    // Очистка при размонтировании
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [user]);
  
  // Обработчики изменения фильтров
  const cityFilterOptions = useMemo(
    () => [
      { value: '', label: 'Все города' },
      ...cities.map((city) => ({ value: city, label: city }))
    ],
    [cities]
  );
  
  const handleCapacityChange = (e, index) => {
    const newRange = [...filters.capacityRange];
    newRange[index] = parseInt(e.target.value);
    setFilters({...filters, capacityRange: newRange});
  };
  
  const resetFilters = () => {
    setFilters({
      city: "",
      capacityRange: [0, 100]
    });
  };
  
  // Функция для проверки существующей заявки от пользователя
  const checkExistingApplication = async (shelterId) => {
    if (!user || !user.token) return false;
    
    try {
      const response = await fetch(`/api/volunteers/check/${shelterId}`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      
      if (response.status === 401) {
        // Обработка истечения токена
        try {
          console.log('Token expired during check, attempting to refresh...');
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
            
            // Try checking again with new token
            return checkExistingApplication(shelterId);
          }
        } catch (refreshError) {
          console.error('Failed to refresh token:', refreshError);
          return false;
        }
      }
      
      const data = await response.json();
      return data.exists;
    } catch (error) {
      console.error("Error checking existing application:", error);
      return false;
    }
  };
  
  // Открытие формы волонтера
  const openVolunteerForm = async (shelter) => {
    if (!user) {
      showAuthModal('стать волонтером');
      return;
    }
    
    // Проверяем, есть ли уже заявка от этого пользователя для этого приюта
    const hasExistingApplication = await checkExistingApplication(shelter._id);
    
    if (hasExistingApplication) {
      setApplicationError(`Вы уже подали заявку на волонтерство в приюте "${shelter.name}". Пожалуйста, дождитесь рассмотрения вашей заявки.`);
      setTimeout(() => setApplicationError(null), 5000);
      return;
    }
    
    setSelectedShelter(shelter);
    setShowVolunteerForm(true);
  };
  
  // Закрытие формы волонтера
  const closeVolunteerForm = (success = false) => {
    setShowVolunteerForm(false);
    if (success) {
      setShowVolunteerSuccess(true);
    } else {
      setSelectedShelter(null);
    }
  };
  
  // Закрытие окна успешной отправки
  const closeSuccessMessage = () => {
    setShowVolunteerSuccess(false);
    setSelectedShelter(null);
  };
  
  // Открытие модального окна пожертвований
  const openDonationModal = (shelter) => {
    setSelectedShelter(shelter);
    setShowDonationModal(true);
  };
  
  // Закрытие модального окна пожертвований
  const closeDonationModal = (shouldRefresh = false) => {
    setShowDonationModal(false);
    if (shouldRefresh && selectedShelter) {
      // Обновляем статистику для конкретного приюта
      fetchDonationStats(selectedShelter._id);
    }
    setSelectedShelter(null);
  };
  
  // Получение статистики пожертвований для приюта
  const fetchDonationStats = async (shelterId) => {
    try {
      const response = await fetch(`/api/donations/shelter/${shelterId}/stats`);
      if (response.ok) {
        const data = await response.json();
        setDonationStats(prev => ({
          ...prev,
          [shelterId]: data
        }));
      }
    } catch (error) {
      console.error('Error fetching donation stats:', error);
    }
  };

  // Обновляем стиль оповещения, чтобы было более заметным
  const notificationStyle = {
    position: 'fixed',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 1000,
    padding: '15px 25px',
    backgroundColor: '#6504b5',
    color: 'white',
    borderRadius: '8px',
    boxShadow: '0 5px 15px rgba(0, 0, 0, 0.3)',
    display: 'flex',
    alignItems: 'center',
    animation: 'slideDown 0.5s ease-out',
    maxWidth: '90%',
    width: 'auto'
  };

  const sendAIMessage = async (e) => {
    e.preventDefault();
    if (!aiInput.trim() || aiLoading) return;
    if (!user) {
      showAuthModal('использовать AI-ассистента');
      return;
    }
    const userMsg = { role: 'user', text: aiInput.trim() };
    setAiMessages(prev => [...prev, userMsg]);
    setAiInput('');
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai-chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
        body: JSON.stringify({ message: aiInput.trim(), mode: 'qa' })
      });
      const data = await res.json();
      const reply = data.reply || data.message || 'Извините, не удалось получить ответ.';
      setAiMessages(prev => [...prev, { role: 'assistant', text: reply }]);
    } catch {
      setAiMessages(prev => [...prev, { role: 'assistant', text: 'Ошибка сети. Попробуйте позже.' }]);
    } finally {
      setAiLoading(false);
      setTimeout(() => { aiChatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100);
    }
  };

  if (loading) return <div className="loading">Загрузка данных о приютах...</div>;
  if (error) return <div className="error-message">Ошибка: {error}</div>;
  if (shelters.length === 0) return <div className="no-shelters">Приюты не найдены</div>;

  return (
    <div className="shelters-container">
      {notification && (
        <div style={notificationStyle} className="shelter-notification">
          <span style={{ marginRight: '10px', display: 'inline-flex', verticalAlign: 'middle' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          {notification}
          <button 
            onClick={() => setNotification(null)} 
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'white', 
              fontSize: '1.2rem', 
              marginLeft: '15px',
              cursor: 'pointer'
            }}
          >
            ×
          </button>
        </div>
      )}
      
      {applicationError && (
        <div className="shelter-notification" style={{
          ...notificationStyle,
          backgroundColor: '#f44336'
        }}>
          {applicationError}
          <button 
            onClick={() => setApplicationError(null)} 
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'white', 
              fontSize: '1.2rem', 
              marginLeft: '15px',
              cursor: 'pointer'
            }}
          >
            ×
          </button>
        </div>
      )}
      
      <div className="shelters-header">
        <div className="header-icon">
          <DogIcon />
        </div>
        <h1>Приюты для животных</h1>
        <p className="header-description">
          Здесь представлены приюты, сотрудничающие с нашей платформой. Каждый приют готов принять новых питомцев и помочь им найти любящий дом.
        </p>
        <button className="shelter-ai-btn" onClick={() => setShowAIChat(true)}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"></path>
            <path d="M8 12h8M12 8v8"></path>
          </svg>
          AI Помощник по приютам
        </button>
      </div>
      
      {/* Фильтры */}
      <div className="shelters-filters">
        <div className="filters-title">
          <FilterIcon />
          <h3>Фильтрация</h3>
        </div>
        
        <div className="filter-group">
          <label htmlFor="shelters-city-filter">Город:</label>
          <StyledSelect
            id="shelters-city-filter"
            value={filters.city || ''}
            onChange={(v) => setFilters({ ...filters, city: v })}
            options={cityFilterOptions}
            aria-label="Город"
          />
        </div>
        
        <div className="filter-group">
          <label>Заполненность: {filters.capacityRange[0]}% - {filters.capacityRange[1]}%</label>
          <div className="range-inputs">
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={filters.capacityRange[0]} 
              onChange={(e) => handleCapacityChange(e, 0)}
            />
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={filters.capacityRange[1]} 
              onChange={(e) => handleCapacityChange(e, 1)}
            />
          </div>
        </div>
        
        <button className="reset-filters" onClick={resetFilters}>Сбросить фильтры</button>
      </div>
      
      {/* Счетчик результатов */}
      <div className="results-count">
        Показано {filteredShelters.length} из {shelters.length} приютов
      </div>
      
      {/* Карточки приютов */}
      <div className="shelters-grid">
        {filteredShelters.length > 0 ? (
          filteredShelters.map((shelter) => {
            const capacityPercentage = Math.round((shelter.current_capacity / shelter.max_capacity) * 100);
            const stats = donationStats[shelter._id] || { totalAmount: 0, donationCount: 0, periodLabel: null };
            const goalPercentage = shelter.donationGoal > 0 
              ? Math.min(Math.round((stats.totalAmount / shelter.donationGoal) * 100), 100) 
              : 0;
            
            return (
              <div key={shelter._id} id={`shelter-${shelter._id}`} className="shelter-card">
                <div className="shelter-header">
                  <div className="shelter-header-left">
                    <img 
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(shelter.name)}&background=random&color=fff&size=128`} 
                      alt={shelter.name} 
                      className="shelter-avatar"
                    />
                    <h2>{shelter.name}</h2>
                  </div>
                  <div className="shelter-header-actions">
                    <button 
                      className="volunteer-button"
                      onClick={() => openVolunteerForm(shelter)}
                    >
                      <VolunteerIcon />
                      Стать волонтером
                    </button>
                    
                    <button 
                      className="donation-button"
                      onClick={() => openDonationModal(shelter)}
                    >
                      <HeartIcon />
                      Пожертвовать
                    </button>
                  </div>
                </div>

                <div className="shelter-info">
                  <div className="info-item">
                    <LocationIcon />
                    <span>{shelter.city}, {shelter.street}, {shelter.house}</span>
                  </div>
                  
                  <div className="info-item">
                    <PhoneIcon />
                    <span>{shelter.phone}</span>
                  </div>
                  
                  <div className="info-item">
                    <EmailIcon />
                    <span>{shelter.email}</span>
                  </div>
                  
                  <div className="info-item">
                    <ClockIcon />
                    <span>{shelter.workingHours}</span>
                  </div>
                </div>

                <div className="shelter-capacity">
                  <div className="capacity-header">
                    <span>Вместимость: {shelter.current_capacity} / {shelter.max_capacity}</span>
                    <span className="capacity-percentage">{capacityPercentage}%</span>
                  </div>
                  <div className="progress-bar-container">
                    <div 
                      className={`progress-bar ${
                        capacityPercentage < 50 ? 'capacity-normal' : 
                        capacityPercentage < 80 ? 'capacity-warning' : 
                        'capacity-critical'
                      }`}
                      style={{ width: `${capacityPercentage}%` }}
                    />
                  </div>
                </div>

                <div className="shelter-description">
                  <div className="description-header">
                    <InfoIcon />
                    <h3>О приюте</h3>
                  </div>
                  <p>{shelter.description}</p>
                </div>

                {/* Блок с пожертвованиями */}
                {(shelter.donationGoal > 0 || stats.totalAmount > 0) && (
                  <div className="donation-stats">
                    <div className="donation-header">
                      <HeartIcon />
                      <div>
                        <h3>Поддержка приюта</h3>
                        {stats.periodLabel && (
                          <p className="donation-period-hint">За {stats.periodLabel}</p>
                        )}
                      </div>
                    </div>
                    {shelter.donationGoal > 0 && (
                      <div className="donation-progress">
                        <div className="progress-info">
                          <span>Собрано: {stats.totalAmount} BYN</span>
                          <span>Цель: {shelter.donationGoal} BYN</span>
                        </div>
                        <div className="donation-progress-bar">
                          <div 
                            className="donation-progress-fill"
                            style={{ width: `${goalPercentage}%` }}
                          />
                        </div>
                        <div className="donation-count">
                          {stats.donationCount} {stats.donationCount === 1 ? 'пожертвование' : 'пожертвований'}
                        </div>
                      </div>
                    )}
                    {!shelter.donationGoal && stats.totalAmount > 0 && (
                      <div className="donation-total">
                        <strong>{stats.totalAmount} BYN</strong> собрано от {stats.donationCount} {stats.donationCount === 1 ? 'донатора' : 'донаторов'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="no-results">Нет приютов, соответствующих выбранным фильтрам</div>
        )}
      </div>
      
      {/* Модальное окно с формой волонтера */}
      {showVolunteerForm && selectedShelter && (
        <div className="modal-overlay">
          <VolunteerForm 
            shelter={selectedShelter} 
            onClose={(success) => closeVolunteerForm(success)} 
          />
        </div>
      )}
      
      {/* Модальное окно с сообщением об успешной отправке заявки */}
      {showVolunteerSuccess && selectedShelter && (
        <div className="modal-overlay">
          <div className="volunteer-form-container">
            <div className="volunteer-form-success">
              <h2>Заявка успешно отправлена!</h2>
              <p>Спасибо за ваше желание стать волонтером в приюте "{selectedShelter.name}".</p>
              <p>Ваша заявка будет рассмотрена в ближайшее время. Мы свяжемся с вами по указанным контактным данным.</p>
              <button onClick={closeSuccessMessage} className="volunteer-form-button">
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Модальное окно пожертвований */}
      {showDonationModal && selectedShelter && (
        <DonationModal 
          shelter={selectedShelter} 
          onClose={closeDonationModal} 
        />
      )}

      {/* AI Chat Modal */}
      {showAIChat && (
        <div className="modal-overlay" style={{ zIndex: 9998 }}>
          <div className="shelter-ai-modal">
            <div className="shelter-ai-modal-header">
              <div className="shelter-ai-modal-title">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
                <span>AI Помощник по приютам</span>
              </div>
              <button className="shelter-ai-close" onClick={() => setShowAIChat(false)}>×</button>
            </div>

            <div className="shelter-ai-messages">
              {aiMessages.length === 0 && (
                <div className="shelter-ai-welcome">
                  <p>Привет! Я AI-ассистент по приютам. Спросите меня о том, как стать волонтёром, как усыновить питомца, о работе приютов или о чём угодно другом!</p>
                  <div className="shelter-ai-suggestions">
                    {['Как стать волонтёром?', 'Как усыновить питомца?', 'Какие приюты есть в Минске?'].map(q => (
                      <button key={q} className="shelter-ai-suggestion-btn" onClick={() => { setAiInput(q); }}>
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {aiMessages.map((msg, i) => (
                <div key={i} className={`shelter-ai-msg ${msg.role === 'user' ? 'shelter-ai-msg-user' : 'shelter-ai-msg-ai'}`}>
                  <div className="shelter-ai-msg-content">{msg.text}</div>
                </div>
              ))}
              {aiLoading && (
                <div className="shelter-ai-msg shelter-ai-msg-ai">
                  <div className="shelter-ai-msg-content shelter-ai-typing">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              )}
              <div ref={aiChatEndRef}></div>
            </div>

            {!user ? (
              <div className="shelter-ai-guest-banner">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <span>Войдите, чтобы задать вопрос AI-ассистенту</span>
                <button onClick={() => { setShowAIChat(false); showAuthModal('AI-ассистента'); }}>Войти</button>
              </div>
            ) : (
              <form className="shelter-ai-input-bar" onSubmit={sendAIMessage}>
                <input
                  type="text"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="Задайте вопрос о приютах..."
                  disabled={aiLoading}
                  className="shelter-ai-input"
                />
                <button type="submit" disabled={aiLoading || !aiInput.trim()} className="shelter-ai-send-btn">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Shelters;

