import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthContext } from '../../hooks/UseAuthContext';
import io from 'socket.io-client';
import axios from 'axios';
import { getSocketServerUrl } from '../../utils/socketServerUrl';
import './ShelterManagement.css';

const ShelterManagement = () => {
  const { user, dispatch } = useAuthContext();
  const [shelters, setShelters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Field-level validation errors
  const [fieldErrors, setFieldErrors] = useState({});
  
  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedShelter, setSelectedShelter] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    city: '',
    street: '',
    house: '',
    phone: '',
    email: '',
    description: '',
    workingHours: '',
    max_capacity: 10,
    current_capacity: 0,
    donationGoal: 0,
    donationDescription: ''
  });
  
  // Состояние для статистики донатов по приютам
  const [donationStats, setDonationStats] = useState({}); // {shelterId: {totalAmount, donationCount}}
  
  // Состояние для истории донатов по приютам
  const [donationHistory, setDonationHistory] = useState({}); // {shelterId: [{year, month, monthName, totalAmount, count, donations}]}
  
  // Состояние для модального окна истории донатов
  const [showDonationHistoryModal, setShowDonationHistoryModal] = useState(false);
  const [selectedShelterForHistory, setSelectedShelterForHistory] = useState(null);
  
  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState('');
  
  // Socket reference
  const socketRef = useRef();
  
  // Initialize socket connection
  useEffect(() => {
    if (!user) return;
    
    // Connect to socket server
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
    
    // Listen for shelter updates
    socket.on('shelterUpdate', (updatedShelter) => {
      setShelters(prevShelters => {
        const shelterIndex = prevShelters.findIndex(shelter => shelter._id === updatedShelter._id);
        
        if (shelterIndex >= 0) {
          // Update existing shelter
          const updatedShelters = [...prevShelters];
          updatedShelters[shelterIndex] = updatedShelter;
          return updatedShelters;
        } else {
          // Add new shelter
          setSuccess(`Новый приют ${updatedShelter.name} добавлен в систему`);
          setTimeout(() => setSuccess(null), 3000);
          return [...prevShelters, updatedShelter];
        }
      });
    });
    
    // Listen for shelter deletions
    socket.on('shelterDeleted', ({ id }) => {
      setShelters(prevShelters => prevShelters.filter(shelter => shelter._id !== id));
      setSuccess('Приют был удален из системы');
      setTimeout(() => setSuccess(null), 3000);
    });
    
    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [user, dispatch]);

  
  // Прокручиваем modal-content в начало при открытии
  useEffect(() => {
    if (showAddForm || showEditForm) {
      setTimeout(() => {
        const modalContent = document.querySelector('.shelter-form-modal .modal-content');
        if (modalContent) {
          modalContent.scrollTop = 0;
          modalContent.scrollTo({ top: 0, behavior: 'auto' });
        }
      }, 50);
    }
  }, [showAddForm, showEditForm]);
  
  // Fetch all shelters
    const fetchShelters = async () => {
    if (!user || !user.token) return;
    
      setLoading(true);
      try {
        const response = await fetch('/api/shelters', {
          headers: { 
            'Authorization': `Bearer ${user.token}` 
          }
        });
        
        if (!response.ok) {
          throw new Error('Не удалось загрузить данные о приютах');
        }
        
        const data = await response.json();
      const sheltersList = Array.isArray(data) ? data : [];
      setShelters(sheltersList);
        setError(null);
      
      // Обновляем статистику донатов для всех приютов
      sheltersList.forEach(shelter => {
        fetchDonationStats(shelter._id);
      });
      } catch (err) {
        console.error('Ошибка загрузки данных о приютах:', err);
        setError('Не удалось загрузить данные о приютах. Пожалуйста, попробуйте позже.');
      } finally {
        setLoading(false);
      }
    };
    
  useEffect(() => {
    if (user && user.token) {
      fetchShelters();
    }
  }, [user]);
  
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // If user changes a field, clear the error for that field
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
    
    setFormData(prevState => ({
      ...prevState,
      [name]: name === 'max_capacity' || name === 'current_capacity' 
        ? parseInt(value) || 0 
        : value
    }));
  };
  
  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      city: '',
      street: '',
      house: '',
      phone: '',
      email: '',
      description: '',
      workingHours: '',
      max_capacity: 10,
      current_capacity: 0,
      donationGoal: 0,
      donationDescription: ''
    });
    setFieldErrors({});
  };
  
  // Open add shelter form
  const handleAddShelter = () => {
    resetForm();
    setShowAddForm(true);
  };
  
  // Open edit shelter form
  const handleEditShelter = (shelter) => {
    setSelectedShelter(shelter);
    setFormData({
      name: shelter.name,
      city: shelter.city,
      street: shelter.street,
      house: shelter.house,
      phone: shelter.phone,
      email: shelter.email,
      description: shelter.description,
      workingHours: shelter.workingHours,
      max_capacity: shelter.max_capacity,
      current_capacity: shelter.current_capacity,
      donationGoal: shelter.donationGoal || 0,
      donationDescription: shelter.donationDescription || ''
    });
    setShowEditForm(true);
  };
  
  // Загрузка статистики донатов для приюта
  const fetchDonationStats = useCallback(async (shelterId) => {
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
  }, []);
  
  // Загрузка истории донатов для приюта
  const fetchDonationHistory = useCallback(async (shelterId) => {
    try {
      const response = await fetch(`/api/donations/shelter/${shelterId}/history`);
      if (response.ok) {
        const data = await response.json();
        setDonationHistory(prev => ({
          ...prev,
          [shelterId]: data
        }));
      }
    } catch (error) {
      console.error('Error fetching donation history:', error);
    }
  }, []);
  
  // Загрузка статистики и истории для всех приютов
  useEffect(() => {
    if (shelters.length > 0) {
      shelters.forEach(shelter => {
        fetchDonationStats(shelter._id);
        fetchDonationHistory(shelter._id);
      });
    }
  }, [shelters]);
  
  // Слушаем обновления донатов через сокеты
  useEffect(() => {
    if (!socketRef.current) return;
    
    const socket = socketRef.current;
    
    const handleNewDonation = ({ shelter_id }) => {
      console.log('Received new donation for shelter:', shelter_id);
      // Обновляем статистику и историю донатов для приюта
      fetchDonationStats(shelter_id);
      fetchDonationHistory(shelter_id);
    };
    
    const handleDonationGoalReset = ({ shelter_id }) => {
      console.log('Received donation goal reset for shelter:', shelter_id);
      // Обновляем статистику приюта
      fetchShelters();
    };
    
    socket.on('newDonation', handleNewDonation);
    socket.on('donationGoalReset', handleDonationGoalReset);
    
    return () => {
      socket.off('newDonation', handleNewDonation);
      socket.off('donationGoalReset', handleDonationGoalReset);
    };
  }, [fetchDonationStats, fetchDonationHistory, fetchShelters]);
  
  // Открытие модального окна истории донатов
  const handleOpenDonationHistory = (shelter) => {
    setSelectedShelterForHistory(shelter);
    setShowDonationHistoryModal(true);
    
    // Загружаем историю, если она еще не загружена
    if (!donationHistory[shelter._id]) {
      fetchDonationHistory(shelter._id);
    }
  };
  
  // Закрытие модального окна истории донатов
  const handleCloseDonationHistory = () => {
    setShowDonationHistoryModal(false);
    setSelectedShelterForHistory(null);
  };
  
  // Форматирование даты
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Show confirmation dialog
  const showConfirm = (message, action) => {
    setConfirmMessage(message);
    setConfirmAction(() => action);
    setShowConfirmDialog(true);
  };
  
  // Handle confirmation dialog response
  const handleConfirm = () => {
    if (confirmAction) {
      confirmAction();
    }
    setShowConfirmDialog(false);
  };
  
  // Handle delete shelter
  const handleDeleteShelter = (shelter) => {
    // Проверка наличия животных в приюте
    if (shelter.current_capacity > 0) {
      const errorMessage = `Невозможно удалить приют "${shelter.name}", так как в нем находятся животные (${shelter.current_capacity}). Переместите всех животных в другие приюты перед удалением.`;
      setError(errorMessage);
      setTimeout(() => setError(null), 7000); // Показываем уведомление дольше из-за важности сообщения
      return;
    }
    
    showConfirm(
      `Вы уверены, что хотите удалить приют "${shelter.name}"? Это действие нельзя отменить.`,
      async () => {
        try {
          const response = await fetch(`/api/shelters/${shelter._id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${user.token}`
            }
          });
          
          if (!response.ok) {
            throw new Error('Не удалось удалить приют');
          }
          
          // Remove shelter from local state (socket will also update this)
          setShelters(shelters.filter(s => s._id !== shelter._id));
          setSuccess(`Приют "${shelter.name}" успешно удален`);
          setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
          console.error('Ошибка при удалении приюта:', err);
          setError(`Не удалось удалить приют: ${err.message}`);
          setTimeout(() => setError(null), 5000);
        }
      }
    );
  };
  
  // Валидация телефона
  const validatePhone = (value) => {
    if (!value.trim()) return 'Телефон обязателен';
    const phonePattern = /^\+375[0-9]{9}$/;
    if (!phonePattern.test(value)) return 'Введите корректный номер телефона в формате +375XXXXXXXXX';
    return '';
  };
  
  // Валидация всех полей формы
  const validateForm = () => {
    const errors = {};
    
    // Валидация названия
    if (!formData.name.trim()) {
      errors.name = 'Название приюта обязательно';
    } else if (formData.name.length < 3) {
      errors.name = 'Название должно содержать минимум 3 символа';
    }
    
    // Валидация email
    if (!formData.email.trim()) {
      errors.email = 'Email обязателен';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Введите корректный email адрес';
    }
    
    // Валидация адреса
    if (!formData.city.trim()) {
      errors.city = 'Город обязателен';
    }
    
    if (!formData.street.trim()) {
      errors.street = 'Улица обязательна';
    }
    
    if (!formData.house.trim()) {
      errors.house = 'Номер дома обязателен';
    }
    
    // Валидация телефона
    const phoneError = validatePhone(formData.phone);
    if (phoneError) {
      errors.phone = phoneError;
    }
    
    // Валидация часов работы
    if (!formData.workingHours.trim()) {
      errors.workingHours = 'Часы работы обязательны';
    }
    
    // Валидация вместимости
    if (formData.max_capacity <= 0) {
      errors.max_capacity = 'Максимальная вместимость должна быть больше 0';
    }
    
    if (formData.current_capacity < 0) {
      errors.current_capacity = 'Текущая вместимость не может быть отрицательной';
    }
    
    if (formData.current_capacity > formData.max_capacity) {
      errors.current_capacity = 'Текущая вместимость не может превышать максимальную';
    }
    
    // Валидация описания
    if (!formData.description.trim()) {
      errors.description = 'Описание обязательно';
    } else if (formData.description.length < 20) {
      errors.description = 'Описание должно содержать минимум 20 символов';
    }
    
    return errors;
  };

  // Submit handler for add/edit forms
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Валидация полей формы
    const validationErrors = validateForm();
    
    // Если есть ошибки валидации, показываем и прекращаем отправку
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setError('Пожалуйста, исправьте ошибки в форме');
      setTimeout(() => setError(null), 5000);
      return;
    }
    
    // Сбрасываем ошибки валидации
    setFieldErrors({});
    
    try {
      let response;
      let method;
      let url;
      
      if (showEditForm && selectedShelter) {
        // Update existing shelter
        method = 'PUT';
        url = `/api/shelters/${selectedShelter._id}`;
      } else {
        // Create new shelter
        method = 'POST';
        url = '/api/shelters';
      }
      
      response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify(formData)
      });
      
      const responseData = await response.json();
      
      if (!response.ok) {
        // Check for field-specific errors
        if (responseData.field && responseData.code === 'DUPLICATE_NAME') {
          setFieldErrors({
            [responseData.field]: responseData.error
          });
          throw new Error(responseData.error);
        } else {
          throw new Error(responseData.error || `Не удалось ${showEditForm ? 'обновить' : 'создать'} приют`);
        }
      }
      
      // Update local state (socket will also handle this)
      if (showEditForm) {
        setShelters(shelters.map(shelter => 
          shelter._id === selectedShelter._id ? responseData : shelter
        ));
        setSuccess(`Приют "${responseData.name}" успешно обновлен`);
      } else {
        setShelters([...shelters, responseData]);
        setSuccess(`Приют "${responseData.name}" успешно создан`);
      }
      
      // Reset and close forms
      resetForm();
      setShowAddForm(false);
      setShowEditForm(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error(`Ошибка при ${showEditForm ? 'обновлении' : 'создании'} приюта:`, err);
      setError(`Не удалось ${showEditForm ? 'обновить' : 'создать'} приют: ${err.message}`);
      setTimeout(() => setError(null), 5000);
    }
  };
  
  // Calculate capacity percentage for UI
  const calculateCapacityPercentage = (current, max) => {
    return (current / max) * 100;
  };
  
  // Get CSS class for capacity indicator
  const getCapacityClass = (current, max) => {
    const percentage = calculateCapacityPercentage(current, max);
    if (percentage >= 90) return 'capacity-critical';
    if (percentage >= 75) return 'capacity-warning';
    return 'capacity-normal';
  };

  return (
    <div className="shelter-management-container">
      <div className="shelter-management-header">
        <h1>Управление приютами</h1>
        <p>Создание, редактирование и удаление приютов в системе</p>
        <button className="add-shelter-btn" onClick={handleAddShelter}>
          Добавить новый приют
        </button>
      </div>
      
      {/* Notifications */}
      {error && (
        <div className="notification-banner">
          <div className="notification-content" style={{ backgroundColor: '#f44336' }}>
            {error}
            <button className="notification-close" onClick={() => setError(null)}>×</button>
          </div>
        </div>
      )}
      
      {success && (
        <div className="notification-banner">
          <div className="notification-content" style={{ backgroundColor: '#4caf50' }}>
            {success}
            <button className="notification-close" onClick={() => setSuccess(null)}>×</button>
          </div>
        </div>
      )}
      
      {/* Confirmation Dialog */}
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
      
      {/* Add Shelter Form */}
      {showAddForm && (
        <div className="modal-overlay">
          <div className="modal shelter-form-modal">
            <div className="modal-header">
              <h2>Добавить новый приют</h2>
              <button className="close-modal" onClick={() => setShowAddForm(false)}>×</button>
            </div>
            <div className="modal-content">
              <form onSubmit={handleSubmit} className="shelter-form">
                <div className="form-section">
                  <h4 className="form-section-title">Основная информация</h4>
                  
                  <div className="form-group">
                    <label>Название приюта</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Введите название приюта"
                      className={fieldErrors.name ? "input-error" : formData.name ? "field-valid" : ""}
                      required
                    />
                    {fieldErrors.name && (
                      <div className="field-error-message">{fieldErrors.name}</div>
                    )}
                  </div>
                  
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="Введите email для связи"
                      className={fieldErrors.email ? "input-error" : formData.email ? "field-valid" : ""}
                      required
                    />
                    {fieldErrors.email && (
                      <div className="field-error-message">{fieldErrors.email}</div>
                    )}
                  </div>
                </div>
                
                <div className="form-section">
                  <h4 className="form-section-title">Адрес приюта</h4>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label>Город</label>
                      <input
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                        placeholder="Введите город"
                        className={fieldErrors.city ? "input-error" : formData.city ? "field-valid" : ""}
                        required
                      />
                      {fieldErrors.city && (
                        <div className="field-error-message">{fieldErrors.city}</div>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label>Улица</label>
                      <input
                        type="text"
                        name="street"
                        value={formData.street}
                        onChange={handleInputChange}
                        placeholder="Введите улицу"
                        className={fieldErrors.street ? "input-error" : formData.street ? "field-valid" : ""}
                        required
                      />
                      {fieldErrors.street && (
                        <div className="field-error-message">{fieldErrors.street}</div>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label>Дом</label>
                      <input
                        type="text"
                        name="house"
                        value={formData.house}
                        onChange={handleInputChange}
                        placeholder="Номер дома"
                        className={fieldErrors.house ? "input-error" : formData.house ? "field-valid" : ""}
                        required
                      />
                      {fieldErrors.house && (
                        <div className="field-error-message">{fieldErrors.house}</div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="form-section">
                  <h4 className="form-section-title">Контактная информация и режим работы</h4>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label>Телефон</label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="Формат: +375XXXXXXXXX"
                        className={fieldErrors.phone ? "input-error" : formData.phone ? "field-valid" : ""}
                        required
                      />
                      {fieldErrors.phone && (
                        <div className="field-error-message">{fieldErrors.phone}</div>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label>Часы работы</label>
                      <input
                        type="text"
                        name="workingHours"
                        value={formData.workingHours}
                        onChange={handleInputChange}
                        placeholder="Например: Пн-Пт 9:00-18:00"
                        className={fieldErrors.workingHours ? "input-error" : formData.workingHours ? "field-valid" : ""}
                        required
                      />
                      {fieldErrors.workingHours && (
                        <div className="field-error-message">{fieldErrors.workingHours}</div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="form-section">
                  <h4 className="form-section-title">Вместимость приюта</h4>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label>Максимальная вместимость</label>
                      <input
                        type="number"
                        name="max_capacity"
                        value={formData.max_capacity}
                        onChange={handleInputChange}
                        min="1"
                        className={fieldErrors.max_capacity ? "input-error" : ""}
                        required
                      />
                      {fieldErrors.max_capacity && (
                        <div className="field-error-message">{fieldErrors.max_capacity}</div>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label>Текущая вместимость</label>
                      <input
                        type="number"
                        name="current_capacity"
                        value={formData.current_capacity}
                        onChange={handleInputChange}
                        min="0"
                        max={formData.max_capacity}
                        className={fieldErrors.current_capacity ? "input-error" : ""}
                        required
                      />
                      {fieldErrors.current_capacity && (
                        <div className="field-error-message">{fieldErrors.current_capacity}</div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="form-section">
                  <h4 className="form-section-title">Описание приюта</h4>
                  
                  <div className="form-group">
                    <label>Описание</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Подробное описание приюта (минимум 20 символов)"
                      rows="4"
                      className={fieldErrors.description ? "input-error" : formData.description.length >= 20 ? "field-valid" : ""}
                      required
                    ></textarea>
                    {fieldErrors.description && (
                      <div className="field-error-message">{fieldErrors.description}</div>
                    )}
                    <div className="char-counter">
                      {formData.description.length}/20 символов минимум
                    </div>
                  </div>
                </div>
                
                <div className="form-section">
                  <h4 className="form-section-title">Пожертвования</h4>
                  
                  <div className="form-group">
                    <label>Цель сбора средств (BYN)</label>
                    <input
                      type="number"
                      name="donationGoal"
                      value={formData.donationGoal}
                      onChange={handleInputChange}
                      min="0"
                      placeholder="0 - если цель не установлена"
                      className={fieldErrors.donationGoal ? "input-error" : ""}
                    />
                    {fieldErrors.donationGoal && (
                      <div className="field-error-message">{fieldErrors.donationGoal}</div>
                    )}
                    <small className="field-note">Установите цель сбора средств в белорусских рублях. Если оставить 0, сбор средств будет отключен.</small>
                  </div>
                  
                  <div className="form-group">
                    <label>Описание цели сбора</label>
                    <textarea
                      name="donationDescription"
                      value={formData.donationDescription}
                      onChange={handleInputChange}
                      placeholder="Опишите, на что будут потрачены собранные средства (например: ремонт вольеров, закупка корма, ветеринарные услуги)"
                      rows="3"
                      className={fieldErrors.donationDescription ? "input-error" : ""}
                    ></textarea>
                    {fieldErrors.donationDescription && (
                      <div className="field-error-message">{fieldErrors.donationDescription}</div>
                    )}
                    <small className="field-note">Это описание будет отображаться пользователям при пожертвовании.</small>
                  </div>
                </div>
                
                <div className="form-actions">
                  <button type="button" className="cancel-btn" onClick={() => setShowAddForm(false)}>
                    Отмена
                  </button>
                  <button type="submit" className="submit-btn">
                    Добавить приют
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit Shelter Form */}
      {/* Модальное окно истории донатов */}
      {showDonationHistoryModal && selectedShelterForHistory && (
        <div className="modal-overlay" onClick={handleCloseDonationHistory}>
          <div className="modal donation-history-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>История пожертвований: {selectedShelterForHistory.name}</h3>
              <button className="btn-close" onClick={handleCloseDonationHistory}>×</button>
            </div>
            <div className="modal-content donation-history-modal-content">
              {donationHistory[selectedShelterForHistory._id] ? (
                donationHistory[selectedShelterForHistory._id].length > 0 ? (
                  <div className="donation-history-list">
                    {donationHistory[selectedShelterForHistory._id].map((monthData, index) => (
                      <div key={`${monthData.year}-${monthData.month}`} className="donation-history-month">
                        <div className="donation-history-month-header">
                          <h5>{monthData.monthName}</h5>
                          <div className="donation-history-month-summary">
                            <span className="donation-history-total">
                              Всего: <strong>{monthData.totalAmount.toFixed(2)} BYN</strong>
                            </span>
                            <span className="donation-history-count">
                              Пожертвований: <strong>{monthData.count}</strong>
                            </span>
                          </div>
                        </div>
                        <div className="donation-history-donations">
                          {monthData.donations.map((donation, donationIndex) => (
                            <div key={donationIndex} className="donation-history-item">
                              <div className="donation-history-item-main">
                                <span className="donation-history-amount">
                                  {donation.amount.toFixed(2)} {donation.currency || 'BYN'}
                                </span>
                                <span className="donation-history-donor">
                                  {donation.isAnonymous ? 'Анонимный донатор' : (donation.userName || 'Без имени')}
                                </span>
                                <span className="donation-history-date">
                                  {formatDate(donation.createdAt)}
                                </span>
                              </div>
                              {donation.message && (
                                <div className="donation-history-message">
                                  "{donation.message}"
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-donation-history">
                    <p>История пожертвований пуста</p>
                  </div>
                )
              ) : (
                <div className="loading-history">
                  <p>Загрузка истории пожертвований...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {showEditForm && selectedShelter && (
        <div className="modal-overlay">
          <div className="modal shelter-form-modal">
            <div className="modal-header">
              <h2>Редактировать приют</h2>
              <button className="close-modal" onClick={() => setShowEditForm(false)}>×</button>
            </div>
            <div className="modal-content">
              <form onSubmit={handleSubmit} className="shelter-form">
                <div className="form-section">
                  <h4 className="form-section-title">Основная информация</h4>
                  
                  <div className="form-group">
                    <label>Название приюта</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Введите название приюта"
                      className={fieldErrors.name ? "input-error" : formData.name ? "field-valid" : ""}
                      required
                    />
                    {fieldErrors.name && (
                      <div className="field-error-message">{fieldErrors.name}</div>
                    )}
                  </div>
                  
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="Введите email для связи"
                      className={fieldErrors.email ? "input-error" : formData.email ? "field-valid" : ""}
                      required
                    />
                    {fieldErrors.email && (
                      <div className="field-error-message">{fieldErrors.email}</div>
                    )}
                  </div>
                </div>
                
                <div className="form-section">
                  <h4 className="form-section-title">Адрес приюта</h4>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label>Город</label>
                      <input
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                        placeholder="Введите город"
                        className={fieldErrors.city ? "input-error" : formData.city ? "field-valid" : ""}
                        required
                      />
                      {fieldErrors.city && (
                        <div className="field-error-message">{fieldErrors.city}</div>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label>Улица</label>
                      <input
                        type="text"
                        name="street"
                        value={formData.street}
                        onChange={handleInputChange}
                        placeholder="Введите улицу"
                        className={fieldErrors.street ? "input-error" : formData.street ? "field-valid" : ""}
                        required
                      />
                      {fieldErrors.street && (
                        <div className="field-error-message">{fieldErrors.street}</div>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label>Дом</label>
                      <input
                        type="text"
                        name="house"
                        value={formData.house}
                        onChange={handleInputChange}
                        placeholder="Номер дома"
                        className={fieldErrors.house ? "input-error" : formData.house ? "field-valid" : ""}
                        required
                      />
                      {fieldErrors.house && (
                        <div className="field-error-message">{fieldErrors.house}</div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="form-section">
                  <h4 className="form-section-title">Контактная информация и режим работы</h4>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label>Телефон</label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="Формат: +375XXXXXXXXX"
                        className={fieldErrors.phone ? "input-error" : formData.phone ? "field-valid" : ""}
                        required
                      />
                      {fieldErrors.phone && (
                        <div className="field-error-message">{fieldErrors.phone}</div>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label>Часы работы</label>
                      <input
                        type="text"
                        name="workingHours"
                        value={formData.workingHours}
                        onChange={handleInputChange}
                        placeholder="Например: Пн-Пт 9:00-18:00"
                        className={fieldErrors.workingHours ? "input-error" : formData.workingHours ? "field-valid" : ""}
                        required
                      />
                      {fieldErrors.workingHours && (
                        <div className="field-error-message">{fieldErrors.workingHours}</div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="form-section">
                  <h4 className="form-section-title">Вместимость приюта</h4>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label>Максимальная вместимость</label>
                      <input
                        type="number"
                        name="max_capacity"
                        value={formData.max_capacity}
                        onChange={handleInputChange}
                        min="1"
                        className={fieldErrors.max_capacity ? "input-error" : ""}
                        required
                      />
                      {fieldErrors.max_capacity && (
                        <div className="field-error-message">{fieldErrors.max_capacity}</div>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label>Текущая вместимость</label>
                      <input
                        type="number"
                        name="current_capacity"
                        value={formData.current_capacity}
                        onChange={handleInputChange}
                        min="0"
                        max={formData.max_capacity}
                        className={fieldErrors.current_capacity ? "input-error" : ""}
                        disabled
                        required
                      />
                      {fieldErrors.current_capacity && (
                        <div className="field-error-message">{fieldErrors.current_capacity}</div>
                      )}
                      <small className="field-note">Текущая вместимость обновляется автоматически и не может быть изменена вручную.</small>
                    </div>
                  </div>
                </div>
                
                <div className="form-section">
                  <h4 className="form-section-title">Описание приюта</h4>
                  
                  <div className="form-group">
                    <label>Описание</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Подробное описание приюта (минимум 20 символов)"
                      rows="4"
                      className={fieldErrors.description ? "input-error" : formData.description.length >= 20 ? "field-valid" : ""}
                      required
                    ></textarea>
                    {fieldErrors.description && (
                      <div className="field-error-message">{fieldErrors.description}</div>
                    )}
                    <div className="char-counter">
                      {formData.description.length}/20 символов минимум
                    </div>
                  </div>
                </div>
                
                <div className="form-section">
                  <h4 className="form-section-title">Пожертвования</h4>
                  
                  <div className="form-group">
                    <label>Цель сбора средств (BYN)</label>
                    <input
                      type="number"
                      name="donationGoal"
                      value={formData.donationGoal}
                      onChange={handleInputChange}
                      min="0"
                      placeholder="0 - если цель не установлена"
                      className={fieldErrors.donationGoal ? "input-error" : ""}
                    />
                    {fieldErrors.donationGoal && (
                      <div className="field-error-message">{fieldErrors.donationGoal}</div>
                    )}
                    <small className="field-note">Установите цель сбора средств в белорусских рублях. Если оставить 0, сбор средств будет отключен.</small>
                  </div>
                  
                  <div className="form-group">
                    <label>Описание цели сбора</label>
                    <textarea
                      name="donationDescription"
                      value={formData.donationDescription}
                      onChange={handleInputChange}
                      placeholder="Опишите, на что будут потрачены собранные средства (например: ремонт вольеров, закупка корма, ветеринарные услуги)"
                      rows="3"
                      className={fieldErrors.donationDescription ? "input-error" : ""}
                    ></textarea>
                    {fieldErrors.donationDescription && (
                      <div className="field-error-message">{fieldErrors.donationDescription}</div>
                    )}
                    <small className="field-note">Это описание будет отображаться пользователям при пожертвовании.</small>
                  </div>
                </div>
                
                <div className="form-actions">
                  <button type="button" className="cancel-btn" onClick={() => setShowEditForm(false)}>
                    Отмена
                  </button>
                  <button type="submit" className="submit-btn">
                    Сохранить изменения
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {/* Search */}
      <div className="requests-search-bar" style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Поиск по названию, городу или email приюта..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="requests-search-input"
        />
        {searchQuery && (
          <button className="requests-search-clear" onClick={() => setSearchQuery('')}>×</button>
        )}
      </div>

      {/* Shelters List */}
      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Загрузка приютов...</p>
        </div>
      ) : shelters.length > 0 ? (
        <div className="shelters-grid">
          {shelters.filter(shelter => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return (
              (shelter.name || '').toLowerCase().includes(q) ||
              (shelter.city || '').toLowerCase().includes(q) ||
              (shelter.email || '').toLowerCase().includes(q) ||
              (shelter.street || '').toLowerCase().includes(q)
            );
          }).map(shelter => {
            const capacityPercentage = calculateCapacityPercentage(shelter.current_capacity, shelter.max_capacity);
            const capacityClass = getCapacityClass(shelter.current_capacity, shelter.max_capacity);
            
            return (
              <div key={shelter._id} className="shelter-card">
                <div className="shelter-card-header">
                  <h2>{shelter.name}</h2>
                  <div className="shelter-actions">
                    <button 
                      className="edit-btn" 
                      onClick={() => handleEditShelter(shelter)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M18.5 2.50001C18.8978 2.10219 19.4374 1.87869 20 1.87869C20.5626 1.87869 21.1022 2.10219 21.5 2.50001C21.8978 2.89784 22.1213 3.43741 22.1213 4.00001C22.1213 4.56262 21.8978 5.10219 21.5 5.50001L12 15L8 16L9 12L18.5 2.50001Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                      <button 
                      className={`delete-btn ${shelter.current_capacity > 0 ? 'disabled-btn' : ''}`}
                        onClick={() => handleDeleteShelter(shelter)}
                      title={shelter.current_capacity > 0 ? `Нельзя удалить приют с животными (${shelter.current_capacity})` : 'Удалить приют'}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M3 6H5H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6L18.2 20C18.1444 20.5312 17.8904 21.0226 17.4897 21.3753C17.089 21.728 16.5713 21.9166 16.037 21.9054H7.963C7.42868 21.9166 6.91098 21.728 6.51029 21.3753C6.10961 21.0226 5.85558 20.5312 5.8 20L5 6H19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                  </div>
                </div>
                
                <div className="shelter-details">
                  <div className="detail-group">
                    <label>Адрес:</label>
                    <p>{shelter.city}, {shelter.street}, {shelter.house}</p>
                  </div>
                  <div className="detail-group">
                    <label>Контакты:</label>
                    <p>{shelter.phone} | {shelter.email}</p>
                  </div>
                  <div className="detail-group">
                    <label>Часы работы:</label>
                    <p>{shelter.workingHours}</p>
                  </div>
                  <div className="detail-group">
                    <label>Заполненность:</label>
                    <div className="shelter-capacity">
                      <div className="capacity-header">
                        <span>Вместимость: {shelter.current_capacity} / {shelter.max_capacity}</span>
                        <span className="capacity-percentage">{Math.round(capacityPercentage)}%</span>
                      </div>
                      <div className="progress-bar-container">
                        <div 
                          className={`progress-bar ${capacityClass}`} 
                          style={{width: `${capacityPercentage}%`}}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Статистика донатов */}
                  {donationStats[shelter._id] && (
                    <div className="detail-group donation-stats-group">
                      <label>
                        Пожертвования
                        {donationStats[shelter._id].periodLabel && (
                          <span className="donation-period-inline"> (за {donationStats[shelter._id].periodLabel})</span>
                        )}
                        :
                      </label>
                      <div className="donation-stats">
                        <div className="donation-stat-item">
                          <span className="donation-stat-label">Собрано:</span>
                          <span className="donation-stat-value">{donationStats[shelter._id].totalAmount || 0} BYN</span>
                        </div>
                        {donationStats[shelter._id].donationGoal > 0 && (
                          <div className="donation-stat-item">
                            <span className="donation-stat-label">Цель:</span>
                            <span className="donation-stat-value">{donationStats[shelter._id].donationGoal} BYN</span>
                          </div>
                        )}
                        <div className="donation-stat-item">
                          <span className="donation-stat-label">Пожертвований:</span>
                          <span className="donation-stat-value">{donationStats[shelter._id].donationCount || 0}</span>
                        </div>
                        {donationStats[shelter._id].donationGoal > 0 && (
                          <div className="donation-progress">
                            <div className="donation-progress-bar">
                              <div 
                                className="donation-progress-fill"
                                style={{ 
                                  width: `${Math.min(Math.round((donationStats[shelter._id].totalAmount / donationStats[shelter._id].donationGoal) * 100), 100)}%` 
                                }}
                              />
                            </div>
                            <div className="donation-progress-text">
                              {Math.min(Math.round((donationStats[shelter._id].totalAmount / donationStats[shelter._id].donationGoal) * 100), 100)}% от цели
                            </div>
                          </div>
                        )}
                        <button 
                          className="view-donation-history-btn"
                          onClick={() => handleOpenDonationHistory(shelter)}
                          title="Просмотреть историю пожертвований"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M14 2V8H20M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          История пожертвований
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="shelter-description">
                  <h3>Описание</h3>
                  <p>{shelter.description}</p>
                  {shelter.donationGoal > 0 && shelter.donationDescription && (
                    <div className="donation-goal-info">
                      <h4>Цель сбора средств: {shelter.donationGoal} BYN</h4>
                      <p>{shelter.donationDescription}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="no-results">
          <div className="no-results-icon">🏠</div>
          <h3>Приюты не найдены</h3>
          <p>В системе не зарегистрировано ни одного приюта. Нажмите кнопку "Добавить новый приют", чтобы создать первый приют.</p>
        </div>
      )}
    </div>
  );
};

export default ShelterManagement; 