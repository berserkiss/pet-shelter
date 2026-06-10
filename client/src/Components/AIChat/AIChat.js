import React, { useState, useEffect, useRef } from 'react';
import { useAuthContext } from '../../hooks/UseAuthContext';
import { useAuthModal } from '../../Context/AuthModalContext';
import './AIChat.css';
import io from 'socket.io-client';
import { getSocketServerUrl } from '../../utils/socketServerUrl';
import AIRobotIcon from '../icons/AIRobotIcon';

// Компонент карточки питомца с интерактивными кнопками
const SuggestedPetCard = ({ pet }) => {
  const { user } = useAuthContext();
  const { showAuthModal } = useAuthModal();
  const [showReasoning, setShowReasoning] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const socketRef = useRef(null);

  // Проверка статуса избранного при загрузке
  useEffect(() => {
    if (user && user.token && pet._id) {
      checkFavoriteStatus();
      
      // Инициализация WebSocket
      socketRef.current = io(getSocketServerUrl(), {
        path: '/socket.io',
        auth: {
          token: user.token
        }
      });

      socketRef.current.on('favoriteAdded', (data) => {
        if (data.pet_id === pet._id || data.pet_id === pet._id?.toString()) {
          if (data.user_id === user._id || data.user_id === user._id?.toString()) {
            setIsFavorite(true);
          }
        }
      });

      socketRef.current.on('favoriteRemoved', (data) => {
        if (data.pet_id === pet._id || data.pet_id === pet._id?.toString()) {
          if (data.user_id === user._id || data.user_id === user._id?.toString()) {
            setIsFavorite(false);
          }
        }
      });

      return () => {
        if (socketRef.current) {
          socketRef.current.disconnect();
        }
      };
    }
  }, [user, pet._id]);

  const checkFavoriteStatus = async () => {
    if (!user || !user.token || !pet._id) return;
    
    try {
      const response = await fetch(`/api/favorites/check/${pet._id}`, {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setIsFavorite(data.isFavorite);
      }
    } catch (error) {
      console.error('Ошибка проверки избранного:', error);
    }
  };

  const handleViewPet = () => {
    window.location.href = `/pawfinds/adopt-form/${pet._id}`;
  };

  const handleToggleFavorite = async (e) => {
    e.stopPropagation();
    
    if (!user || !user.token) {
      showAuthModal('добавить питомца в избранное');
      return;
    }

    setFavoriteLoading(true);
    
    try {
      if (isFavorite) {
        // Удаляем из избранного
        const response = await fetch(`/api/favorites/${pet._id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${user.token}` }
        });
        
        if (response.ok) {
          setIsFavorite(false);
        } else {
          const errorData = await response.json();
          alert(errorData.error || 'Ошибка при удалении из избранного');
        }
      } else {
        // Добавляем в избранное
        const response = await fetch('/api/favorites', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.token}`
          },
          body: JSON.stringify({ pet_id: pet._id })
        });
        
        if (response.ok) {
          setIsFavorite(true);
        } else {
          const errorData = await response.json();
          alert(errorData.error || 'Ошибка при добавлении в избранное');
        }
      }
    } catch (error) {
      console.error('Ошибка работы с избранным:', error);
      alert('Произошла ошибка');
    } finally {
      setFavoriteLoading(false);
    }
  };

  return (
    <div className="suggested-pet-card">
      {pet.image && (
        <div className="suggested-pet-image-wrapper">
        <img 
          src={`/api${pet.image}`} 
          alt={pet.name}
          className="suggested-pet-image"
          onClick={handleViewPet}
          style={{cursor: 'pointer'}}
        />
          {user && (
            <button 
              className={`favorite-overlay-btn ${isFavorite ? 'favorite-active' : ''}`}
              onClick={handleToggleFavorite}
              disabled={favoriteLoading}
              title={isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
            >
              {favoriteLoading ? (
                <span className="favorite-loading">...</span>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
              )}
            </button>
          )}
        </div>
      )}
      <div className="suggested-pet-info">
        <h4>{pet.name}</h4>
        <p>{pet.species} • {pet.breed}</p>
        <p className="pet-age">{pet.age}</p>
        
        {pet.matchScore > 0 && (
          <span className="match-badge">
            Совпадение: {pet.matchScore}%
          </span>
        )}

        {/* AI Reasoning */}
        {pet.aiReasoning && (
          <div className="ai-reasoning-block">
            <button 
              className="reasoning-toggle"
              onClick={() => setShowReasoning(!showReasoning)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{marginRight:'4px',verticalAlign:'middle'}}><path d="M9 21H15M12 3C9.23858 3 7 5.23858 7 8C7 9.86384 7.9948 11.4934 9.5 12.4648V15C9.5 15.5523 9.94772 16 10.5 16H13.5C14.0523 16 14.5 15.5523 14.5 15V12.4648C16.0052 11.4934 17 9.86384 17 8C17 5.23858 14.7614 3 12 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              {showReasoning ? 'Скрыть' : 'Почему этот питомец?'}
            </button>
            {showReasoning && (
              <div className="reasoning-content">
                {pet.aiReasoning}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Кнопки действий */}
      <div className="pet-card-actions">
        <button 
          className="action-btn view-btn"
          onClick={handleViewPet}
          title="Посмотреть подробнее"
        >
          Просмотреть
        </button>
      </div>
    </div>
  );
};

const AIChat = ({ onPetRecommendation, onPreferencesUpdated, onChatRecommendations, isGuest, onGuestClick }) => {
  const { user } = useAuthContext();
  const [isOpen, setIsOpen] = useState(false);
  const [chatMode, setChatMode] = useState('selection');
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedPets, setSuggestedPets] = useState([]);
  const [progress, setProgress] = useState(0);
  const [progressHint, setProgressHint] = useState('');
  const [historyRestored, setHistoryRestored] = useState(false);
  const [clearingPreferences, setClearingPreferences] = useState(false);
  const messagesEndRef = useRef(null);

  // Обработчик клика для гостей
  const handleToggleClick = () => {
    if (isGuest && onGuestClick) {
      onGuestClick();
    } else {
      setIsOpen(!isOpen);
    }
  };

  // История сохраняется на сервере автоматически при отправке сообщений
  // localStorage используется только для режима чата (чтобы запомнить последний выбранный режим)
  const userStorageKey = user?.email || user?._id || '';

  useEffect(() => {
    if (userStorageKey) {
      localStorage.setItem(`aiChat_mode_${userStorageKey}`, chatMode);
    }
  }, [chatMode, userStorageKey]);

  // Автопрокрутка к последнему сообщению
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Загрузка истории с сервера при монтировании компонента
  const loadHistoryFromServer = async (mode) => {
    if (!user?.token) return;
    
    try {
      const response = await fetch(`/api/ai-chat/history?mode=${mode}`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.history && data.history.length > 0) {
          // Преобразуем историю из формата БД в формат компонента
          const formattedMessages = data.history.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp || new Date().toISOString(),
            suggestedPets: msg.suggestedPets || []
          }));
          
          setMessages(formattedMessages);
          
          // Восстанавливаем рекомендованных питомцев из всех сообщений
          const allSuggestedPets = [];
          formattedMessages.forEach(msg => {
            if (msg.suggestedPets && Array.isArray(msg.suggestedPets) && msg.suggestedPets.length > 0) {
              allSuggestedPets.push(...msg.suggestedPets);
            }
          });
          // Берем последних рекомендованных питомцев (если есть)
          if (allSuggestedPets.length > 0) {
            setSuggestedPets(allSuggestedPets.slice(-10)); // Последние 10
          }
          
          return true; // История загружена
        }
      }
    } catch (error) {
      console.error('Error loading history from server:', error);
    }
    
    return false; // История не загружена
  };

  // Восстановление истории при загрузке компонента (ОДИН РАЗ при монтировании)
  useEffect(() => {
    if (user?.email && !isGuest && !historyRestored) {
      const savedMode = localStorage.getItem(`aiChat_mode_${user.email}`) || 'selection';
      setChatMode(savedMode);
      
      // Загружаем историю с сервера
      loadHistoryFromServer(savedMode).then(historyLoaded => {
        if (!historyLoaded) {
          // Если истории нет, загружаем приветствие
          loadWelcomeMessage(savedMode);
        }
        setHistoryRestored(true);
      });
    }
  }, [user?.email, isGuest, historyRestored]);

  // Загрузка истории при открытии чата (если еще не загружена)
  useEffect(() => {
    if (isOpen && user && !isGuest && historyRestored && messages.length === 0) {
      // Если чат открыт, но сообщений нет, загружаем историю с сервера
      loadHistoryFromServer(chatMode).then(historyLoaded => {
        if (!historyLoaded) {
          loadWelcomeMessage(chatMode);
        }
      });
    }
  }, [isOpen, historyRestored, user, isGuest, chatMode]);

  // Слушаем событие для открытия чата из других компонентов
  useEffect(() => {
    const handleOpenAIChat = () => {
      if (!isGuest) {
        setIsOpen(true);
      }
    };

    window.addEventListener('openAIChat', handleOpenAIChat);
    return () => {
      window.removeEventListener('openAIChat', handleOpenAIChat);
    };
  }, [isGuest]);

  const loadWelcomeMessage = async (mode = chatMode) => {
    try {
      const response = await fetch(`/api/ai-chat/welcome?mode=${mode}`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMessages([{
          role: 'assistant',
          content: data.message,
          timestamp: data.timestamp
        }]);
      }
    } catch (error) {
      console.error('Error loading welcome message:', error);
      const welcomeMessage = mode === 'selection' 
        ? 'Привет! Я помогу тебе найти идеального питомца. Расскажи, кого ты ищешь?'
        : 'Привет! Я отвечу на твои вопросы о животных и приютах. Спрашивай что угодно!';
      setMessages([{
        role: 'assistant',
        content: welcomeMessage,
        timestamp: new Date().toISOString()
      }]);
    }
  };

  // Переключение режима чата
  const handleModeChange = async (newMode) => {
    if (newMode === chatMode) return;
    
    setChatMode(newMode);
    setMessages([]);
    setSuggestedPets([]);
    setProgress(0);
    setProgressHint('');
    
    // Загружаем историю с сервера для нового режима
    const historyLoaded = await loadHistoryFromServer(newMode);
    if (!historyLoaded) {
      // Если истории нет, загружаем приветствие
      setTimeout(() => {
        loadWelcomeMessage(newMode);
      }, 100);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');

    // Добавляем сообщение пользователя
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    }]);

    setIsLoading(true);

    try {
      const response = await fetch('/api/ai-chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ 
          message: userMessage,
          mode: chatMode // Передаем режим чата
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Добавляем ответ AI
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.message,
          timestamp: data.timestamp,
          suggestedPets: data.suggestedPets
        }]);

        // Обновляем прогресс
        if (data.progress !== undefined) {
          setProgress(data.progress);
          setProgressHint(data.progressHint || '');
          console.log('📊 Прогресс:', data.progress + '%');
        }

        // Обновляем рекомендованных питомцев
        if (data.suggestedPets && data.suggestedPets.length > 0) {
          setSuggestedPets(data.suggestedPets);
          if (onPetRecommendation) {
            onPetRecommendation(data.suggestedPets);
          }
          // Блок «Рекомендации» из ответа чата — без второго AI-запроса на /recommendations
          if (onChatRecommendations) {
            onChatRecommendations(data.suggestedPets);
          }
        }

        // Обновляем рекомендации на главной странице (если предпочтения изменились, но suggestedPets не пришли)
        if (data.conversationContext && Object.keys(data.conversationContext).length > 0 && !(data.suggestedPets && data.suggestedPets.length > 0)) {
          if (onPreferencesUpdated) {
            onPreferencesUpdated();
          }
          // Сообщаем всему приложению, что предпочтения обновились
          try {
            window.dispatchEvent(new CustomEvent('ai:prefs-updated'));
          } catch (_) {}
        }
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Извините, произошла ошибка. Попробуйте еще раз.',
        timestamp: new Date().toISOString(),
        isError: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = async () => {
    try {
      await fetch(`/api/ai-chat/history?mode=${chatMode}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      
      // Очищаем состояние
      setMessages([]);
      setSuggestedPets([]);
      setProgress(0);
      setProgressHint('');
      
      // Загружаем новое приветствие
      loadWelcomeMessage(chatMode);
    } catch (error) {
      console.error('Error clearing chat:', error);
    }
  };

  const clearPreferences = async () => {
    if (!user?.token || clearingPreferences) return;

    setClearingPreferences(true);
    try {
      const response = await fetch('/api/user/preferences', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to clear preferences');
      }

      setMessages([]);
      setSuggestedPets([]);
      setProgress(0);
      setProgressHint('');
      await loadWelcomeMessage(chatMode);

      if (onPreferencesUpdated) {
        onPreferencesUpdated();
      }
      try {
        window.dispatchEvent(new CustomEvent('ai:prefs-updated'));
      } catch (_) {}
    } catch (error) {
      console.error('Error clearing preferences:', error);
      alert('Не удалось очистить предпочтения');
    } finally {
      setClearingPreferences(false);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      {/* Кнопка открытия чата - видна всегда */}
      <button 
        className={`ai-chat-toggle ${isOpen ? 'open' : ''}`}
        onClick={handleToggleClick}
        aria-label="AI помощник"
      >
        {isOpen ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : <AIRobotIcon size={30} variant="onDark" decorative />}
      </button>

      {/* Окно чата - только для авторизованных пользователей */}
      {isOpen && user && !isGuest && (
        <div className="ai-chat-window">
          {/* Заголовок */}
          <div className="ai-chat-header">
            <div className="ai-chat-header-content">
              <span className="ai-chat-avatar">
                <AIRobotIcon size={34} variant="onDark" decorative />
              </span>
              <div>
                <h3>AI Помощник</h3>
                <p className="ai-chat-status">Онлайн</p>
              </div>
            </div>
            <button 
              className="ai-chat-clear-btn"
              onClick={clearChat}
              title="Начать заново"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 4V10H7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3.51 15C4.47 17.37 6.59 19.07 9.11 19.5C11.63 19.94 14.2 19.07 15.93 17.19C17.66 15.31 18.32 12.67 17.7 10.17C17.08 7.67 15.25 5.62 12.82 4.74C10.39 3.87 7.68 4.28 5.63 5.83L1 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {/* Сообщения */}
          <div className="ai-chat-messages">
            {messages.map((msg, index) => (
              <div 
                key={index} 
                className={`ai-chat-message ${msg.role} ${msg.isError ? 'error' : ''}`}
              >
                <div className="message-content">
                  {msg.content}
                </div>
                <div className="message-time">
                  {formatTime(msg.timestamp)}
                </div>
                
                {/* Рекомендованные питомцы */}
                {msg.suggestedPets && msg.suggestedPets.length > 0 && (
                  <div className="suggested-pets">
                    <p className="suggested-pets-title">Рекомендую посмотреть:</p>
                    {msg.suggestedPets.map(pet => (
                      <SuggestedPetCard key={pet._id} pet={pet} />
                    ))}
                  </div>
                )}
              </div>
            ))}
            
            {isLoading && (
              <div className="ai-chat-message assistant">
                <div className="message-content typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Поле ввода */}
          <form className="ai-chat-input-form" onSubmit={sendMessage}>
            <input
              type="text"
              className="ai-chat-input"
              placeholder="Напишите сообщение..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={isLoading}
            />
            <button 
              type="submit" 
              className="ai-chat-send-btn"
              disabled={isLoading || !inputMessage.trim()}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </form>

          {/* Переключатель режимов и подсказки */}
          <div className="ai-chat-mode-switcher">
            <button 
              className={`mode-btn ${chatMode === 'selection' ? 'active' : ''}`}
              onClick={() => handleModeChange('selection')}
              title="Подбор питомца по вашим критериям"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg> Подбор питомца
            </button>
            <button 
              className={`mode-btn ${chatMode === 'qa' ? 'active' : ''}`}
              onClick={() => handleModeChange('qa')}
              title="Задавайте вопросы о животных и приютах"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg> Вопросы и ответы
            </button>
          </div>

          <div className="ai-chat-prefs-action">
            <button
              type="button"
              className="ai-chat-clear-prefs-btn"
              onClick={clearPreferences}
              disabled={clearingPreferences}
              title="Сбросить предпочтения, собранные из диалога с AI"
            >
              {clearingPreferences ? 'Очищаем…' : 'Очистить предпочтения'}
            </button>
          </div>

          {/* Подсказки для быстрого старта */}
          {messages.length === 1 && !isLoading && inputMessage === '' && (
            <div className="ai-chat-suggestions">
              {chatMode === 'selection' ? (
                <>
                  <button onClick={() => setInputMessage('Ищу собаку для квартиры')}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 22V12H15V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> Собака для квартиры
                  </button>
                  <button onClick={() => setInputMessage('Хочу спокойную кошку')}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="currentColor"/><circle cx="9" cy="10" r="1.5" fill="currentColor"/><circle cx="15" cy="10" r="1.5" fill="currentColor"/><path d="M9 15c.83 1.2 2.17 2 3 2s2.17-.8 3-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> Спокойная кошка
                  </button>
                  <button onClick={() => setInputMessage('Питомец для семьи с детьми')}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/><path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89317 18.7122 8.75608 18.1676 9.45768C17.623 10.1593 16.8604 10.6597 16 10.88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> Для семьи
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setInputMessage('Какая порода подойдет тихому человеку?')}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2"/></svg> Для тихого человека
                  </button>
                  <button onClick={() => setInputMessage('Какие животные есть в приютах Минска?')}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 10C21 17 12 23 12 23C12 23 3 17 3 10C3 7.61305 3.94821 5.32387 5.63604 3.63604C7.32387 1.94821 9.61305 1 12 1C14.3869 1 16.6761 1.94821 18.364 3.63604C20.0518 5.32387 21 7.61305 21 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="2"/></svg> Животные в Минске
                  </button>
                  <button onClick={() => setInputMessage('Какой уход нужен за кошкой?')}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> Уход за кошкой
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default AIChat;

