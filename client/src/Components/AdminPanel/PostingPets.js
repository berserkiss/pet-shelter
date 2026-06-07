import React, { useState, useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAuthContext } from '../../hooks/UseAuthContext';
import io from 'socket.io-client';
import axios from 'axios';
import './AdoptingRequests.css';
import { formatAge } from '../../utils/ageFormatter';
import { getSocketServerUrl } from '../../utils/socketServerUrl';
import { getPetImageUrl } from '../../utils/petImageUrl';

const PostingPets = () => {
  const { user, dispatch } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Основные данные
  const [pets, setPets] = useState([]);
  const [shelters, setShelters] = useState([]);
  
  // Состояния UI
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPetDetails, setShowPetDetails] = useState(false);
  const [selectedPet, setSelectedPet] = useState(null);
  
  // Состояние диалога подтверждения
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState('');
  
  // Реф сокета
  const socketRef = useRef();
  
  // Инициализация соединения socket
  useEffect(() => {
    if (!user) return;
    
    // Подключаемся к сокет-серверу
    const socket = io(getSocketServerUrl(), {
      path: '/socket.io',
      auth: {
        token: user.token
      }
    });
    
    socketRef.current = socket;
    
    // Явно присоединяемся к комнате shelters для обновлений приютов
    socket.emit('joinRoom', 'shelters');
    
    // Socket error handling
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
    
    // Слушаем обновления в реальном времени
    socket.on('petRequestUpdate', (updatedPet) => {
      setPets(prevPets => {
        return prevPets.map(pet => 
          pet._id === updatedPet._id ? updatedPet : pet
        );
      });
      
      // Показываем сообщение об успехе
      setSuccess(`Заявка ${updatedPet.name} обновлена в реальном времени`);
      setTimeout(() => setSuccess(null), 3000);
    });

    // Добавляем слушатель для новых питомцев
    socket.on('newPet', (newPet) => {
      setPets(prevPets => {
        // Проверяем, нет ли уже такого питомца в списке
        if (prevPets.some(pet => pet._id === newPet._id)) {
          return prevPets;
        }
        
        // Показываем сообщение об успехе
        setSuccess(`Новая заявка на размещение питомца от ${newPet.email}`);
        setTimeout(() => setSuccess(null), 3000);
        
        return [...prevPets, newPet];
      });
    });
    
    // Добавляем слушатель для удаленных питомцев
    socket.on('petDeleted', ({ id }) => {
      setPets(prevPets => prevPets.filter(pet => pet._id !== id));
    });
    
    // Слушаем обновления приютов
    socket.on('shelterUpdate', (updatedShelter) => {
      setShelters(prevShelters => {
        return prevShelters.map(shelter => 
          shelter._id === updatedShelter._id ? updatedShelter : shelter
        );
      });
      
      // Обновляем информацию о приюте в питомцах
      setPets(prevPets => {
        return prevPets.map(pet => {
          if (pet.shelter_id === updatedShelter._id) {
            return {
              ...pet,
              shelter: updatedShelter // Обновляем связанный приют
            };
          }
          return pet;
        });
      });
    });
    
    // Добавляем слушатель для удаленных приютов
    socket.on('shelterDeleted', ({ id }) => {
      setShelters(prevShelters => prevShelters.filter(shelter => shelter._id !== id));
    });
    
    // Очистка при размонтировании
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [user, dispatch]);
  
  // Получение всех питомцев и приютов
  useEffect(() => {
    if (!user) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        // Запрашиваем все питомцы и приюты параллельно
        const [petsRes, sheltersRes] = await Promise.all([
          // Все питомцы
          fetch('/api/admin-pets/allPets', {
            headers: { 
              'Authorization': `Bearer ${user.token}` 
            }
          }),
          // Приюты
          fetch('/api/shelters', {
            headers: { 
              'Authorization': `Bearer ${user.token}` 
            }
          })
        ]);
        
        if (!petsRes.ok || !sheltersRes.ok) {
          throw new Error('Не удалось загрузить данные');
        }
        
        // Обрабатываем ответы
        const petsData = await petsRes.json();
        const sheltersData = await sheltersRes.json();
        
        // Обновляем состояние
        setPets(petsData);
        setShelters(sheltersData);
        
        setError(null);
      } catch (err) {
        console.error('Ошибка загрузки данных:', err);
        setError('Не удалось загрузить данные. Пожалуйста, попробуйте позже.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user]);
  
  // Показ диалога подтверждения
  const showConfirm = (message, action) => {
    setConfirmMessage(message);
    setConfirmAction(() => action);
    setShowConfirmDialog(true);
  };
  
  // Обработка ответа диалога подтверждения
  const handleConfirm = () => {
    if (confirmAction) {
      confirmAction();
    }
    setShowConfirmDialog(false);
  };

  // Обработка одобрения заявки
  const handleApprove = async (pet) => {
    showConfirm(
      'Вы уверены, что хотите одобрить эту заявку?',
      async () => {
        try {
          // Получаем user_id из текущей заявки (если есть)
          const user_id = pet.user_id || null;
          
          const response = await fetch(`/api/admin-pets/approving/${pet._id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify({ 
              status: 'Approved',
              // Явно передаем user_id для установления связи с пользователем
              user_id: user_id
            })
          });
          
          if (!response.ok) {
            throw new Error('Не удалось обновить статус заявки');
          }
          
          // Обновляем локальное состояние
          setPets(prevPets => {
            return prevPets.map(p => 
              p._id === pet._id ? { ...p, status: 'Approved' } : p
            );
          });
          
          // Переключиться на вкладку "Все заявки"
          setActiveTab('all');
          
          setSuccess('Заявка успешно одобрена.');
          setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
          console.error('Ошибка при одобрении заявки:', err);
          setError('Произошла ошибка при обработке заявки: ' + err.message);
          setTimeout(() => setError(null), 5000);
        }
      }
    );
  };
  
  // Установка статуса "На рассмотрении"
  const handleSetInReview = async (pet) => {
    try {
      const response = await fetch(`/api/admin-pets/approving/${pet._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ status: 'InReview' })
      });
      
      if (!response.ok) {
        throw new Error('Не удалось обновить статус заявки');
      }
      
      // Обновляем локальное состояние
      setPets(prevPets => {
        return prevPets.map(p => 
          p._id === pet._id ? { ...p, status: 'InReview' } : p
        );
      });
      
      // Переключиться на вкладку "Все заявки"
      setActiveTab('all');
      
      setSuccess('Заявка помечена как "На рассмотрении".');
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (err) {
      console.error('Ошибка при обновлении статуса заявки:', err);
      setError('Произошла ошибка при обновлении статуса заявки: ' + err.message);
      setTimeout(() => setError(null), 5000);
    }
  };
  
  // Отклонение заявки
  const handleReject = async (pet) => {
    showConfirm(
      'Вы уверены, что хотите отклонить эту заявку?',
      async () => {
        try {
          const response = await fetch(`/api/admin-pets/approving/${pet._id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify({ status: 'Rejected' })
          });
          
          if (!response.ok) {
            throw new Error('Не удалось отклонить заявку');
          }
          
          // Обновляем локальное состояние
          setPets(prevPets => {
            return prevPets.map(p => 
              p._id === pet._id ? { ...p, status: 'Rejected' } : p
            );
          });
          
          // Переключиться на вкладку "Все заявки"
          setActiveTab('all');
          
          setSuccess('Заявка успешно отклонена. Владелец получит уведомление.');
          setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
          console.error('Ошибка при отклонении заявки:', err);
          setError('Произошла ошибка при отклонении заявки: ' + err.message);
          setTimeout(() => setError(null), 5000);
        }
      }
    );
  };
  
  // Фильтрация питомцев на основе активной вкладки и поиска
  const filteredPets = pets.filter(pet => {
    if (activeTab !== 'all') {
      if (activeTab === 'pending' && pet.status !== 'Pending') return false;
      if (activeTab === 'inReview' && pet.status !== 'InReview') return false;
      if (activeTab === 'approved' && pet.status !== 'Approved') return false;
    }
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (pet.name || '').toLowerCase().includes(q) ||
      (pet.species || '').toLowerCase().includes(q) ||
      (pet.breed || '').toLowerCase().includes(q) ||
      (pet.area || '').toLowerCase().includes(q)
    );
  });
  
  // Открытие подробной информации о питомце
  const openPetDetails = (pet) => {
    setSelectedPet(pet);
    setShowPetDetails(true);
  };
  
  // Форматирование времени "прошло с момента"
  const formatTimeAgo = (updatedAt) => {
    const date = new Date(updatedAt);
    return formatDistanceToNow(date, { addSuffix: true, locale: ru });
  };
  
  // CSS класс для бейджа статуса
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Pending': return 'status-badge status-pending';
      case 'InReview': return 'status-badge status-review';
      case 'Approved': return 'status-badge status-approved';
      case 'Adopted': return 'status-badge status-adopted';
      case 'Rejected': return 'status-badge status-rejected';
      default: return 'status-badge';
    }
  };
  
  // Отображаемый текст статуса
  const getStatusLabel = (status) => {
    switch (status) {
      case 'Pending': return 'На рассмотрении';
      case 'InReview': return 'В процессе';
      case 'Approved': return 'Одобрен';
      case 'Adopted': return 'Усыновлен';
      case 'Rejected': return 'Отклонен';
      default: return status;
    }
  };

  // Получить CSS класс для индикатора заполненности приюта
  const getShelterCapacityClass = (current, max) => {
    const percentage = (current / max) * 100;
    if (percentage >= 90) return 'capacity-critical';
    if (percentage >= 75) return 'capacity-warning';
    return 'capacity-normal';
  };
  
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Загрузка заявок...</p>
      </div>
    );
  }

  return (
    <div className="adopting-requests-container">
      <div className="requests-header">
        <h1>Заявки на размещение питомцев</h1>
        <p>Управление заявками от владельцев на размещение питомцев на платформе</p>
      </div>
      
      {/* Уведомления */}
      {error && (
        <div className="notification error">
          {error}
          <button className="close-notification" onClick={() => setError(null)}>×</button>
        </div>
      )}
      
      {success && (
        <div className="notification success">
          {success}
          <button className="close-notification" onClick={() => setSuccess(null)}>×</button>
        </div>
      )}
      
      {/* Диалог подтверждения */}
      {showConfirmDialog && (
        <div className="modal-overlay">
          <div className="modal confirmation-modal">
            <div className="modal-header">
              <h2>Подтверждение</h2>
            </div>
            <div className="modal-content">
              <p>{confirmMessage}</p>
              <div className="confirmation-actions">
                <button 
                  className="cancel-btn" 
                  onClick={() => setShowConfirmDialog(false)}
                >
                  Отмена
                </button>
                <button 
                  className="confirm-btn" 
                  onClick={handleConfirm}
                >
                  Подтвердить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Вкладки */}
      <div className="request-tabs">
        <button 
          className={`tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          Все заявки
        </button>
        <button 
          className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Новые заявки
        </button>
        <button 
          className={`tab ${activeTab === 'inReview' ? 'active' : ''}`}
          onClick={() => setActiveTab('inReview')}
        >
          На рассмотрении
        </button>
        <button 
          className={`tab ${activeTab === 'approved' ? 'active' : ''}`}
          onClick={() => setActiveTab('approved')}
        >
          Одобренные
        </button>
        <button 
          className={`tab ${activeTab === 'adopted' ? 'active' : ''}`}
          onClick={() => setActiveTab('adopted')}
        >
          Усыновленные
        </button>
        <button 
          className={`tab ${activeTab === 'rejected' ? 'active' : ''}`}
          onClick={() => setActiveTab('rejected')}
        >
          Отклоненные
        </button>
      </div>

      {/* Search */}
      <div className="requests-search-bar">
        <input
          type="text"
          placeholder="Поиск по имени питомца, виду, породе или местоположению..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="requests-search-input"
        />
        {searchQuery && (
          <button className="requests-search-clear" onClick={() => setSearchQuery('')}>×</button>
        )}
      </div>
      
      {filteredPets.length === 0 ? (
        <div className="no-results">
          <div className="no-results-icon">🔍</div>
          <h3>Заявки не найдены</h3>
          <p>По выбранному фильтру не найдено заявок на размещение питомцев</p>
        </div>
      ) : (
        <div className="pets-with-applications">
          {filteredPets.map(pet => {
            // Найдем информацию о приюте
            const shelter = shelters.find(s => s._id === pet.shelter_id);
            const shelterCapacityPercentage = shelter ? (shelter.current_capacity / shelter.max_capacity) * 100 : 0;
            const capacityClass = shelter ? getShelterCapacityClass(shelter.current_capacity, shelter.max_capacity) : '';
            
            return (
              <div key={pet._id} className="pet-application-card">
                <div className="pet-card-header">
                  <div className="pet-image" onClick={() => openPetDetails(pet)}>
                    <img 
                      src={getPetImageUrl(pet.filename)} 
                      alt={pet.name}
                      onError={(e) => {
                        if (!e.target.getAttribute('data-error-handled')) {
                          e.target.setAttribute('data-error-handled', 'true');
                          e.target.src = "/api/images/default.jpg";
                          console.log(`Изображение не найдено: ${pet.filename}, загружается default.jpg`);
                        }
                      }}
                    />
                  </div>
                  
                  <div className="pet-info">
                    <h3>{pet.name}</h3>
                    <p>{pet.species}, {pet.breed}</p>
                    <p className="pet-location">{pet.area}</p>
                    <p className="pet-age">Возраст: {formatAge(pet.birthDate)}</p>
                    
                    {shelter && (
                      <div className="shelter-info">
                        <p className="shelter-name"><strong>Приют:</strong> {shelter.name}</p>
                        <div className="shelter-capacity">
                          <span>Заполненность приюта: </span>
                          <div className="capacity-wrapper">
                            <div className="capacity-container">
                              <div
                                className={`capacity-bar ${capacityClass}`}
                                style={{ width: `${shelterCapacityPercentage}%` }}
                              />
                            </div>
                            <span className="capacity-text">
                              {shelter.current_capacity}/{shelter.max_capacity} мест
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="pet-status">
                      <span className={getStatusBadgeClass(pet.status)}>
                        {getStatusLabel(pet.status)}
                      </span>
                      <span className="time-ago">
                        {formatTimeAgo(pet.createdAt)}
                      </span>
                    </div>
                    
                    <div className="pet-contact">
                      <p><strong>Контакт владельца:</strong> {pet.email} | {pet.phone}</p>
                    </div>
                    
                    <button 
                      className="view-details-btn"
                      onClick={() => openPetDetails(pet)}
                    >
                      Подробнее
                    </button>
                  </div>
                </div>
                
                <div className="pet-actions">
                  {pet.status === 'Pending' && (
                    <>
                      <button
                        className="review-btn"
                        onClick={() => handleSetInReview(pet)}
                      >
                        На рассмотрение
                      </button>
                      <button
                        className="approve-btn"
                        onClick={() => handleApprove(pet)}
                        disabled={shelter && shelter.current_capacity >= shelter.max_capacity}
                        title={shelter && shelter.current_capacity >= shelter.max_capacity ? 
                          "Приют заполнен, невозможно добавить питомца" : ""}
                      >
                        Одобрить
                      </button>
                      <button
                        className="reject-btn"
                        onClick={() => handleReject(pet)}
                      >
                        Отклонить
                      </button>
                    </>
                  )}
                  
                  {pet.status === 'InReview' && (
                    <>
                      <button
                        className="approve-btn"
                        onClick={() => handleApprove(pet)}
                        disabled={shelter && shelter.current_capacity >= shelter.max_capacity}
                        title={shelter && shelter.current_capacity >= shelter.max_capacity ? 
                          "Приют заполнен, невозможно добавить питомца" : ""}
                      >
                        Одобрить
                      </button>
                      <button
                        className="reject-btn"
                        onClick={() => handleReject(pet)}
                      >
                        Отклонить
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Модальное окно с деталями питомца */}
      {showPetDetails && selectedPet && (
        <div className="modal-overlay">
          <div className="modal pet-details-modal">
            <div className="modal-header">
              <h2>Информация о питомце</h2>
              <button className="close-modal" onClick={() => setShowPetDetails(false)}>×</button>
            </div>
            
            <div className="modal-content">
              <div className="pet-details-flex">
                <div className="pet-details-image">
                  <img 
                    src={getPetImageUrl(selectedPet.filename)} 
                    alt={selectedPet.name}
                    onError={(e) => {
                      if (!e.target.getAttribute('data-error-handled')) {
                        e.target.setAttribute('data-error-handled', 'true');
                        e.target.src = "/api/images/default.jpg";
                        console.log(`Изображение не найдено: ${selectedPet.filename}, загружается default.jpg`);
                      }
                    }}
                  />
                </div>
                
                <div className="pet-details-info">
                  <h3>{selectedPet.name}</h3>
                  <p><strong>Вид:</strong> {selectedPet.species}</p>
                  <p><strong>Порода:</strong> {selectedPet.breed}</p>
                  <p><strong>Возраст:</strong> {formatAge(selectedPet.birthDate)}</p>
                  <p><strong>Местоположение:</strong> {selectedPet.area}</p>
                  <p><strong>Email владельца:</strong> {selectedPet.email}</p>
                  <p><strong>Телефон владельца:</strong> {selectedPet.phone}</p>
                  
                  {/* Информация о приюте */}
                  {(() => {
                    const shelter = shelters.find(s => s._id === selectedPet.shelter_id);
                    if (shelter) {
                      const shelterCapacityPercentage = (shelter.current_capacity / shelter.max_capacity) * 100;
                      const capacityClass = getShelterCapacityClass(shelter.current_capacity, shelter.max_capacity);
                      
                      return (
                        <div className="shelter-details">
                          <h4>Информация о приюте</h4>
                          <p><strong>Название:</strong> {shelter.name}</p>
                          <p><strong>Адрес:</strong> {shelter.city}, {shelter.street}, {shelter.house}</p>
                          <p><strong>Контакт:</strong> {shelter.contact || shelter.phone || 'Нет данных'}</p>
                          
                          <div className="shelter-capacity-detail">
                            <p><strong>Заполненность:</strong></p>
                            <div className="capacity-wrapper">
                              <div className="capacity-container">
                                <div
                                  className={`capacity-bar ${capacityClass}`}
                                  style={{ width: `${shelterCapacityPercentage}%` }}
                                />
                              </div>
                              <span className="capacity-text">
                                {shelter.current_capacity}/{shelter.max_capacity} мест ({Math.round(shelterCapacityPercentage)}%)
                              </span>
                            </div>
                            
                            {shelter.current_capacity >= shelter.max_capacity && (
                              <p className="capacity-warning-text">
                                Приют заполнен! Размещение новых питомцев невозможно без освобождения места.
                              </p>
                            )}
                            {shelter.current_capacity >= shelter.max_capacity * 0.9 && shelter.current_capacity < shelter.max_capacity && (
                              <p className="capacity-warning-text">
                                Приют почти заполнен! Осталось {shelter.max_capacity - shelter.current_capacity} мест.
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return <p><strong>Приют:</strong> Информация недоступна</p>;
                  })()}
                  
                  <div className="pet-status">
                    <strong>Статус:</strong> 
                    <span className={getStatusBadgeClass(selectedPet.status)}>
                      {getStatusLabel(selectedPet.status)}
                    </span>
                  </div>
                  
                  {selectedPet.description && (
                    <div className="pet-description">
                      <h4>Описание</h4>
                      <p>{selectedPet.description}</p>
                    </div>
                  )}
                  
                  {selectedPet.justification && (
                    <div className="pet-justification">
                      <h4>Обоснование</h4>
                      <p>{selectedPet.justification}</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="pet-details-actions">
                {selectedPet.status === 'Pending' && (
                  <>
                    <button
                      className="review-btn"
                      onClick={() => {
                        handleSetInReview(selectedPet);
                        setShowPetDetails(false);
                      }}
                    >
                      На рассмотрение
                    </button>
                    <button
                      className="approve-btn"
                      onClick={() => {
                        handleApprove(selectedPet);
                        setShowPetDetails(false);
                      }}
                      disabled={(() => {
                        const shelter = shelters.find(s => s._id === selectedPet.shelter_id);
                        return shelter && shelter.current_capacity >= shelter.max_capacity;
                      })()}
                      title={(() => {
                        const shelter = shelters.find(s => s._id === selectedPet.shelter_id);
                        return shelter && shelter.current_capacity >= shelter.max_capacity ? 
                          "Приют заполнен, невозможно добавить питомца" : "";
                      })()}
                    >
                      Одобрить
                    </button>
                    <button
                      className="reject-btn"
                      onClick={() => {
                        handleReject(selectedPet);
                        setShowPetDetails(false);
                      }}
                    >
                      Отклонить
                    </button>
                  </>
                )}
                
                {selectedPet.status === 'InReview' && (
                  <>
                    <button
                      className="approve-btn"
                      onClick={() => {
                        handleApprove(selectedPet);
                        setShowPetDetails(false);
                      }}
                      disabled={(() => {
                        const shelter = shelters.find(s => s._id === selectedPet.shelter_id);
                        return shelter && shelter.current_capacity >= shelter.max_capacity;
                      })()}
                      title={(() => {
                        const shelter = shelters.find(s => s._id === selectedPet.shelter_id);
                        return shelter && shelter.current_capacity >= shelter.max_capacity ? 
                          "Приют заполнен, невозможно добавить питомца" : "";
                      })()}
                    >
                      Одобрить
                    </button>
                    <button
                      className="reject-btn"
                      onClick={() => {
                        handleReject(selectedPet);
                        setShowPetDetails(false);
                      }}
                    >
                      Отклонить
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostingPets;
