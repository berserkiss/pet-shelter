import React, { useState, useEffect, useRef } from 'react';
import { useAuthContext } from '../../hooks/UseAuthContext';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import io from 'socket.io-client';
import axios from 'axios';
import './AdoptingRequests.css'; // Используем те же стили
import './VolunteerApplications.css'; // Стили для заявок на волонтерство
import { getSocketServerUrl } from '../../utils/socketServerUrl';

const VolunteerApplications = () => {
  const { user, dispatch } = useAuthContext();
  const [applications, setApplications] = useState([]);
  const [shelters, setShelters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Состояния UI
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showApplicationDetails, setShowApplicationDetails] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [selectedShelter, setSelectedShelter] = useState(null);
  const [adminMessage, setAdminMessage] = useState('');
  
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
    socket.on('volunteerApplication', (application) => {
      setApplications(prevApplications => {
        // Проверяем, есть ли уже такая заявка в списке
        if (prevApplications.some(app => app._id === application._id)) {
          return prevApplications.map(app => 
            app._id === application._id ? application : app
          );
        }
        
        // Показываем сообщение об успехе
        setSuccess(`Новая заявка на волонтерство от ${application.name}`);
        setTimeout(() => setSuccess(null), 3000);
        
        return [application, ...prevApplications];
      });
    });
    
    socket.on('volunteerStatusUpdate', (application) => {
      setApplications(prevApplications => {
        return prevApplications.map(app => 
          app._id === application._id ? application : app
        );
      });
      
      // Показываем сообщение об успехе
      setSuccess(`Статус заявки от ${application.name} обновлен`);
      setTimeout(() => setSuccess(null), 3000);
    });
    
    socket.on('volunteerDeleted', ({ id }) => {
      setApplications(prevApplications => prevApplications.filter(app => app._id !== id));
      setSuccess('Заявка удалена');
      setTimeout(() => setSuccess(null), 3000);
    });
    
    // Добавляем обработчик обновлений приютов
    socket.on('shelterUpdate', (updatedShelter) => {
      console.log('Получено обновление приюта через WebSocket:', updatedShelter);
      
      // Обновляем список приютов
      setShelters(prevShelters => {
        const shelterIndex = prevShelters.findIndex(shelter => shelter._id === updatedShelter._id);
        if (shelterIndex >= 0) {
          const updatedShelters = [...prevShelters];
          updatedShelters[shelterIndex] = updatedShelter;
          return updatedShelters;
        }
        return [...prevShelters, updatedShelter];
      });
      
      // Обновляем информацию о приюте в заявках
      setApplications(prevApplications => {
        return prevApplications.map(app => {
          if (app.shelter_id === updatedShelter._id) {
            return {
              ...app,
              shelter_name: updatedShelter.name,
              shelterDetails: updatedShelter
            };
          }
          return app;
        });
      });
      
      // Если текущий выбранный приют обновился, обновляем его
      if (selectedShelter && selectedShelter._id === updatedShelter._id) {
        setSelectedShelter(updatedShelter);
      }
    });
    
    // Очистка при размонтировании
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [user, dispatch]);
  
  // Загрузка данных при первом рендере
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Запрашиваем все заявки и приюты параллельно
        const [applicationsRes, sheltersRes] = await Promise.all([
          fetch('/api/volunteers', {
            headers: { 
              'Authorization': `Bearer ${user.token}` 
            }
          }),
          fetch('/api/shelters', {
            headers: { 
              'Authorization': `Bearer ${user.token}` 
            }
          })
        ]);
        
        if (!applicationsRes.ok || !sheltersRes.ok) {
          throw new Error('Не удалось загрузить данные');
        }
        
        // Обрабатываем ответы
        const applicationsData = await applicationsRes.json();
        const sheltersData = await sheltersRes.json();
        
        // Обновляем состояние
        setApplications(applicationsData);
        setShelters(sheltersData);
        
        setError(null);
      } catch (err) {
        console.error('Ошибка загрузки данных:', err);
        setError('Не удалось загрузить данные. Пожалуйста, попробуйте позже.');
      } finally {
        setLoading(false);
      }
    };
    
    if (user && user.token) {
      fetchData();
    }
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
  const handleApprove = async (application) => {
    showConfirm(
      'Вы уверены, что хотите одобрить эту заявку на волонтерство?',
      async () => {
        try {
          const response = await fetch(`/api/volunteers/${application._id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify({ 
              status: 'Approved',
              adminMessage: adminMessage 
            })
          });
          
          if (!response.ok) {
            throw new Error('Не удалось обновить статус заявки');
          }
          
          const updatedApplication = await response.json();
          
          // Обновляем локальное состояние
          setApplications(prevApplications => {
            return prevApplications.map(app => 
              app._id === application._id ? updatedApplication : app
            );
          });
          
          // Очищаем сообщение
          setAdminMessage('');
          
          // Закрываем модальное окно
          setShowApplicationDetails(false);
          
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
  
  // Отклонение заявки
  const handleReject = async (application) => {
    showConfirm(
      'Вы уверены, что хотите отклонить эту заявку?',
      async () => {
        try {
          const response = await fetch(`/api/volunteers/${application._id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify({ 
              status: 'Rejected',
              adminMessage: adminMessage 
            })
          });
          
          if (!response.ok) {
            throw new Error('Не удалось обновить статус заявки');
          }
          
          const updatedApplication = await response.json();
          
          // Обновляем локальное состояние
          setApplications(prevApplications => {
            return prevApplications.map(app => 
              app._id === application._id ? updatedApplication : app
            );
          });
          
          // Очищаем сообщение
          setAdminMessage('');
          
          // Закрываем модальное окно
          setShowApplicationDetails(false);
          
          setSuccess('Заявка успешно отклонена.');
          setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
          console.error('Ошибка при отклонении заявки:', err);
          setError('Произошла ошибка при обработке заявки: ' + err.message);
          setTimeout(() => setError(null), 5000);
        }
      }
    );
  };
  
  // Удаление заявки
  const handleDelete = async (application) => {
    showConfirm(
      'Вы уверены, что хотите удалить эту заявку? Это действие нельзя отменить.',
      async () => {
        try {
          const response = await fetch(`/api/volunteers/${application._id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${user.token}`
            }
          });
          
          if (!response.ok) {
            throw new Error('Не удалось удалить заявку');
          }
          
          // Обновляем локальное состояние - удаляем заявку из списка
          setApplications(prevApplications => prevApplications.filter(app => app._id !== application._id));
          
          // Закрываем модальное окно
          setShowApplicationDetails(false);
          
          setSuccess('Заявка успешно удалена.');
          setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
          console.error('Ошибка при удалении заявки:', err);
          setError('Произошла ошибка при удалении заявки: ' + err.message);
          setTimeout(() => setError(null), 5000);
        }
      }
    );
  };
  
  // Фильтрация заявок на основе активной вкладки и поиска
  const filteredApplications = applications.filter(application => {
    if (activeTab !== 'all') {
      if (activeTab === 'pending' && application.status !== 'Pending') return false;
      if (activeTab === 'approved' && application.status !== 'Approved') return false;
      if (activeTab === 'rejected' && application.status !== 'Rejected') return false;
    }
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const shelter = shelters.find(s => s._id === application.shelter_id);
    return (
      (application.name || '').toLowerCase().includes(q) ||
      (application.email || '').toLowerCase().includes(q) ||
      (application.phone || '').toLowerCase().includes(q) ||
      (shelter && (shelter.name || '').toLowerCase().includes(q))
    );
  });
  
  // Открытие подробной информации о заявке
  const openApplicationDetails = (application) => {
    setSelectedApplication(application);
    
    // Find the corresponding shelter for this application
    const shelter = shelters.find(s => s._id === application.shelter_id);
    setSelectedShelter(shelter || null);
    
    setShowApplicationDetails(true);
    setAdminMessage('');
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
      case 'Approved': return 'status-badge status-approved';
      case 'Rejected': return 'status-badge status-rejected';
      default: return 'status-badge';
    }
  };
  
  // Отображаемый текст статуса
  const getStatusLabel = (status) => {
    switch (status) {
      case 'Pending': return 'На рассмотрении';
      case 'Approved': return 'Одобрена';
      case 'Rejected': return 'Отклонена';
      default: return status;
    }
  };
  
  // Деталиализированная информация о заявке
  const renderApplicationDetails = () => {
    if (!selectedApplication) return null;
    
    return (
      <div className="application-details">
        <div className="details-header">
          <h3>Детали заявки</h3>
          <div className={getStatusBadgeClass(selectedApplication.status)}>
            {getStatusLabel(selectedApplication.status)}
          </div>
        </div>
        
        <div className="details-content">
          <div className="details-section">
            <h4>Информация о кандидате</h4>
            <div className="details-grid">
              <div className="detail-item">
                <span className="detail-label">Имя:</span>
                <span className="detail-value">{selectedApplication.name}</span>
              </div>
              
              <div className="detail-item">
                <span className="detail-label">Email:</span>
                <span className="detail-value">{selectedApplication.email}</span>
              </div>
              
              <div className="detail-item">
                <span className="detail-label">Телефон:</span>
                <span className="detail-value">{selectedApplication.phone}</span>
              </div>
              
              <div className="detail-item">
                <span className="detail-label">Возраст:</span>
                <span className="detail-value">{selectedApplication.age} лет</span>
              </div>
            </div>
          </div>
          
          <div className="details-section">
            <h4>Информация о приюте</h4>
            <div className="details-grid">
              <div className="detail-item full-width">
                <span className="detail-label">Приют:</span>
                <span className="detail-value">
                  {selectedShelter ? selectedShelter.name : 'Загрузка...'}
                </span>
              </div>
              
              {selectedShelter && (
                <div className="detail-item full-width">
                  <span className="detail-label">Адрес приюта:</span>
                  <span className="detail-value">
                    {selectedShelter.city}, {selectedShelter.street}, {selectedShelter.house}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div className="details-section">
            <h4>Доступность и опыт</h4>
            <div className="details-grid">
              <div className="detail-item full-width">
                <span className="detail-label">Доступность:</span>
                <span className="detail-value">{selectedApplication.availability}</span>
              </div>
              
              {selectedApplication.experience && (
                <div className="detail-item full-width">
                  <span className="detail-label">Опыт:</span>
                  <span className="detail-value">{selectedApplication.experience}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="details-section">
            <h4>Навыки и интересы</h4>
            {selectedApplication.skills && selectedApplication.skills.length > 0 && (
              <div className="detail-item full-width">
                <span className="detail-label">Навыки:</span>
                <div className="tags-container">
                  {selectedApplication.skills.map((skill, index) => (
                    <span key={index} className="skill-tag">{skill}</span>
                  ))}
                </div>
              </div>
            )}
            
            {selectedApplication.interests && selectedApplication.interests.length > 0 && (
              <div className="detail-item full-width">
                <span className="detail-label">Интересы:</span>
                <div className="tags-container">
                  {selectedApplication.interests.map((interest, index) => (
                    <span key={index} className="interest-tag">{interest}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="details-section">
            <h4>Дополнительная информация</h4>
            <div className="detail-item full-width message-container">
              <span className="detail-label">Сообщение от кандидата:</span>
              <div className="message-content">
                {selectedApplication.message}
              </div>
            </div>
            
            <div className="detail-item full-width">
              <span className="detail-label">Дата подачи:</span>
              <span className="detail-value">{formatTimeAgo(selectedApplication.createdAt)}</span>
            </div>
          </div>
        </div>
        
        {/* Сообщение администратора */}
        <div className="admin-message-section">
          <h4>Сообщение для волонтера</h4>
          <p className="admin-message-hint">Это сообщение будет отправлено волонтеру по email вместе с уведомлением о статусе заявки.</p>
          <textarea
            className="admin-message-input"
            value={adminMessage}
            onChange={(e) => setAdminMessage(e.target.value)}
            placeholder="Введите сообщение или дополнительную информацию для волонтера..."
            rows={4}
          />
        </div>
        
        <div className="application-actions">
          {selectedApplication.status === 'Pending' && (
            <>
              <button 
                className="approve-btn" 
                onClick={() => handleApprove(selectedApplication)}
              >
                Одобрить заявку
              </button>
              <button 
                className="reject-btn" 
                onClick={() => handleReject(selectedApplication)}
              >
                Отклонить заявку
              </button>
            </>
          )}
          <div className="volunteer-delete-btn-wrapper">
          <button 
            type="button"
            className="volunteer-app-delete-btn" 
            onClick={() => handleDelete(selectedApplication)}
          >
            Удалить заявку
          </button>
          </div>
        </div>
      </div>
    );
  };
  
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Загрузка заявок на волонтерство...</p>
      </div>
    );
  }
  
  return (
    <div className="adopting-requests-container volunteer-applications-page">
      <div className="requests-header">
        <h1>Заявки на волонтерство</h1>
        <p>Управление заявками от пользователей, желающих стать волонтерами в приютах</p>
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
          На рассмотрении
        </button>
        <button 
          className={`tab ${activeTab === 'approved' ? 'active' : ''}`}
          onClick={() => setActiveTab('approved')}
        >
          Одобренные
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
          placeholder="Поиск по имени, email, телефону или приюту..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="requests-search-input"
        />
        {searchQuery && (
          <button className="requests-search-clear" onClick={() => setSearchQuery('')}>×</button>
        )}
      </div>
      
      {filteredApplications.length === 0 ? (
        <div className="no-results">
          <div className="no-results-icon">🔍</div>
          <h3>Заявки не найдены</h3>
          <p>По выбранному фильтру не найдено заявок на волонтерство</p>
        </div>
      ) : (
        <div className="pets-with-applications">
          {filteredApplications.map(application => {
            // Найдем информацию о приюте
            const shelter = shelters.find(s => s._id === application.shelter_id);
            
            return (
              <div key={application._id} className="pet-application-card">
                <div className="pet-card-header">
                  <div className="applicant-info">
                    <h3>{application.name}</h3>
                    <p><strong>Email:</strong> {application.email}</p>
                    <p><strong>Телефон:</strong> {application.phone}</p>
                    <p><strong>Возраст:</strong> {application.age} лет</p>
                    <p><strong>Приют:</strong> {shelter ? shelter.name : 'Не найден'}</p>
                    <p><strong>Доступность:</strong> {application.availability}</p>
                    
                    <div className="pet-status">
                      <span className={getStatusBadgeClass(application.status)}>
                        {getStatusLabel(application.status)}
                      </span>
                      <span className="time-ago">
                        {formatTimeAgo(application.createdAt)}
                      </span>
                    </div>
                    
                    <button 
                      className="view-details-btn"
                      onClick={() => openApplicationDetails(application)}
                    >
                      Подробнее
                    </button>
                  </div>
                </div>
                
                <div className="pet-actions">
                  {application.status === 'Pending' && (
                    <>
                      <button
                        className="approve-btn"
                        onClick={() => handleApprove(application)}
                      >
                        Одобрить
                      </button>
                      <button
                        className="reject-btn"
                        onClick={() => handleReject(application)}
                      >
                        Отклонить
                      </button>
                    </>
                  )}
                  
                  {(application.status === 'Approved' || application.status === 'Rejected') && (
                    <button
                      className="reject-btn"
                      onClick={() => handleDelete(application)}
                    >
                      Удалить
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Модальное окно с деталями заявки */}
      {showApplicationDetails && selectedApplication && (
        <div className="modal-overlay volunteer-details-overlay">
          <div className="modal pet-details-modal">
            <div className="modal-header">
              <h2>Информация о заявке</h2>
              <button type="button" className="close-modal" onClick={() => setShowApplicationDetails(false)}>×</button>
            </div>
            
            <div className="modal-content">
              {renderApplicationDetails()}
            </div>
          </div>
        </div>
      )}

      {/* Диалог подтверждения — после деталей в DOM и с большим z-index, чтобы был поверх модалки заявки */}
      {showConfirmDialog && (
        <div className="modal-overlay volunteer-confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="volunteer-confirm-title">
          <div className="modal confirmation-modal">
            <div className="modal-header">
              <h2 id="volunteer-confirm-title">Подтверждение</h2>
            </div>
            <div className="modal-content">
              <p>{confirmMessage}</p>
              <div className="confirmation-actions">
                <button 
                  type="button"
                  className="cancel-btn" 
                  onClick={() => setShowConfirmDialog(false)}
                >
                  Отмена
                </button>
                <button 
                  type="button"
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
    </div>
  );
};

export default VolunteerApplications; 