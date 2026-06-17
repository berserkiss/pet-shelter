import React, { useState, useEffect, useRef } from 'react';
import { useAuthContext } from '../../hooks/UseAuthContext';
import { io } from 'socket.io-client';
import { getSocketServerUrl } from '../../utils/socketServerUrl';
import AIRobotIcon from '../icons/AIRobotIcon';
import StyledSelect from '../UI/StyledSelect';
import './PetCareCalendar.css';

/** Миллисекунды в сутках (для расчёта weekly без дробной ошибки) */
const MS_PER_DAY = 86400000;

const CARE_EVENT_TYPE_OPTIONS = [
  { value: 'vaccination', label: 'Прививка' },
  { value: 'vet_checkup', label: 'Осмотр у ветеринара' },
  { value: 'grooming', label: 'Груминг' },
  { value: 'deworming', label: 'Дегельминтизация' },
  { value: 'flea_treatment', label: 'Обработка от блох' },
  { value: 'nail_trimming', label: 'Стрижка когтей' },
  { value: 'teeth_cleaning', label: 'Чистка зубов' },
  { value: 'feeding_schedule', label: 'График кормления' },
  { value: 'exercise', label: 'Физическая активность' },
  { value: 'medication', label: 'Прием лекарств' },
  { value: 'custom', label: 'Другое' }
];

const CARE_PRIORITY_OPTIONS = [
  { value: 'low', label: 'Низкий' },
  { value: 'medium', label: 'Средний' },
  { value: 'high', label: 'Высокий' },
  { value: 'urgent', label: 'Срочный' }
];

/**
 * Проверяет, попадает ли событие на календарный день dayDate.
 * Ежедневные задачи на бэкенде материализуются отдельной записью на каждый день
 * (generateFutureRecurringEvents / processOverdueRecurringEvents). Для daily нужно
 * сопоставлять только точную дату экземпляра: иначе одна просроченная запись
 * «размазывается» на все последующие дни в сетке и в модалке дня.
 */
const eventOccursOnDay = (event, dayDate) => {
  if (!event || !dayDate) return false;
  const target = new Date(dayDate);
  target.setHours(0, 0, 0, 0);
  const start = new Date(event.date);
  start.setHours(0, 0, 0, 0);

  if (event.completed) {
    return start.getTime() === target.getTime();
  }

  const rec = event.recurring;
  if (!rec?.enabled) {
    return start.getTime() === target.getTime();
  }

  const interval = rec.interval;
  if (interval === 'daily' || interval === 'day') {
    return start.getTime() === target.getTime();
  }

  if (target.getTime() < start.getTime()) return false;

  if (rec.endDate) {
    const end = new Date(rec.endDate);
    end.setHours(0, 0, 0, 0);
    if (target.getTime() > end.getTime()) return false;
  }

  if (interval === 'weekly' || interval === 'week') {
    const diffDays = Math.round((target.getTime() - start.getTime()) / MS_PER_DAY);
    return diffDays >= 0 && diffDays % 7 === 0;
  }

  if (interval === 'monthly' || interval === 'month') {
    if (target.getDate() !== start.getDate()) return false;
    const tYm = target.getFullYear() * 12 + target.getMonth();
    const sYm = start.getFullYear() * 12 + start.getMonth();
    return tYm >= sYm;
  }

  if (interval === 'yearly' || interval === 'year') {
    return (
      target.getMonth() === start.getMonth() &&
      target.getDate() === start.getDate() &&
      target.getFullYear() >= start.getFullYear()
    );
  }

  return start.getTime() === target.getTime();
};

const PetCareCalendar = ({ petId, petName }) => {
  const { user } = useAuthContext();
  /** Единый строковый id для URL (из Mongo / React select) */
  const petIdStr = petId != null && petId !== '' ? String(petId) : '';
  const [calendar, setCalendar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [succMessage, setSuccMessage] = useState('');
  const [filter, setFilter] = useState('all'); // all, upcoming, overdue, completed
  const [viewMode, setViewMode] = useState('list'); // list, calendar, week
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [petData, setPetData] = useState(null); // Сохраняем текущие данные питомца для сравнения
  const [showRegeneratePrompt, setShowRegeneratePrompt] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [showEditEvent, setShowEditEvent] = useState(false);
  const [eventToEdit, setEventToEdit] = useState(null);
  const [editEventData, setEditEventData] = useState({
    type: 'custom',
    title: '',
    date: '',
    priority: 'medium',
    description: ''
  });
  const [showDayEventsModal, setShowDayEventsModal] = useState(false);
  const [selectedDayEvents, setSelectedDayEvents] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const socketRef = useRef(null);
  const petDataRef = useRef(null); // Используем ref для доступа к актуальным данным без пересоздания эффекта
  const addEventFormRef = useRef(null);
  const editEventFormRef = useRef(null);
  const addEventModalContentRef = useRef(null);
  const editEventModalContentRef = useRef(null);
  const [newEvent, setNewEvent] = useState({
    type: 'custom',
    title: '',
    date: new Date().toISOString().split('T')[0],
    priority: 'medium',
    description: ''
  });

  useEffect(() => {
    if (!petIdStr) return;
    loadCalendar();
    loadPetData();
  }, [petIdStr, user?.token]);

  // Прокручиваем modal-content к началу при открытии модального окна добавления события
  useEffect(() => {
    if (showAddEvent && addEventModalContentRef.current) {
      // Прокручиваем modal-content, а не форму!
      const scrollToTop = () => {
        if (addEventModalContentRef.current) {
          addEventModalContentRef.current.scrollTop = 0;
        }
      };
      
      scrollToTop();
      requestAnimationFrame(() => {
        scrollToTop();
        setTimeout(scrollToTop, 10);
      });
    }
  }, [showAddEvent]);

  // Прокручиваем форму к началу при открытии модального окна редактирования события
  useEffect(() => {
    if (showEditEvent && editEventFormRef.current) {
      // Используем setTimeout для гарантии, что DOM обновлен
      setTimeout(() => {
        if (editEventFormRef.current) {
          // Прокручиваем форму к самому началу
          editEventFormRef.current.scrollTop = 0;
          // Также прокручиваем первый элемент в видимую область с учетом отступов
          const firstInput = editEventFormRef.current.querySelector('.form-group-title input, .form-group:first-child input');
          if (firstInput) {
            firstInput.scrollIntoView({ behavior: 'instant', block: 'start', inline: 'nearest' });
            // Дополнительно убеждаемся, что прокрутка на самом верху
            editEventFormRef.current.scrollTop = 0;
          }
        }
      }, 50);
    }
  }, [showEditEvent]);

  // Инициализация WebSocket для отслеживания обновлений питомца
  useEffect(() => {
    if (!user?.token || !petIdStr) return;

    // Подключаемся к WebSocket
    socketRef.current = io(getSocketServerUrl(), {
      path: '/socket.io',
      auth: {
        token: user.token
      }
    });

    // Слушаем обновления питомца
    socketRef.current.on('petRequestUpdate', (updatedPet) => {
      if (String(updatedPet._id) === petIdStr) {
        console.log('📅 Получено обновление питомца для календаря:', updatedPet);
        
        // Проверяем, изменились ли критичные для календаря данные
        // Используем ref для получения актуальных данных без зависимости от state
        const criticalFieldsChanged = checkCriticalFieldsChanged(petDataRef.current, updatedPet);
        
        if (criticalFieldsChanged) {
          setPetData(updatedPet);
          petDataRef.current = updatedPet;
          setShowRegeneratePrompt(true);
          
          // Показываем уведомление
          console.log('⚠️ Данные питомца изменились. Рекомендуется перегенерировать календарь.');
        } else {
          // Просто обновляем данные без перегенерации
          setPetData(updatedPet);
          petDataRef.current = updatedPet;
        }
      }
    });

    // Слушаем специальное событие для календаря ухода
    socketRef.current.on('petCareCalendarUpdate', (data) => {
      if (String(data.petId) === petIdStr) {
        console.log('📅 Получено специальное событие обновления календаря:', data);
        setPetData(data.pet);
        petDataRef.current = data.pet;
        setShowRegeneratePrompt(true);
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [petIdStr, user?.token]); // Убрали petData из зависимостей, используем ref

  // Загрузка данных питомца для сравнения
  const loadPetData = async () => {
    if (!user?.token || !petIdStr) return;

    try {
      const response = await fetch(`/api/pets/${petIdStr}`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPetData(data);
        petDataRef.current = data; // Сохраняем в ref для использования в WebSocket обработчиках
      }
    } catch (err) {
      console.error('Ошибка загрузки данных питомца:', err);
    }
  };

  // Проверка изменения критичных полей
  const checkCriticalFieldsChanged = (oldPet, newPet) => {
    if (!oldPet || !newPet) return false;

    const criticalFields = [
      'species',      // Вид животного
      'breed',         // Порода
      'birthDate',     // Дата рождения (возраст)
      'medicalNotes',  // Медицинские заметки
      'size',          // Размер
      'energyLevel',   // Уровень энергии
      'careLevel',     // Сложность ухода
      'activityNeeds'  // Потребность в активности
    ];

    return criticalFields.some(field => {
      const oldValue = oldPet[field];
      const newValue = newPet[field];
      
      // Специальная обработка для дат
      if (field === 'birthDate') {
        const oldDate = oldValue ? new Date(oldValue).toISOString().split('T')[0] : null;
        const newDate = newValue ? new Date(newValue).toISOString().split('T')[0] : null;
        return oldDate !== newDate;
      }
      
      // Для массивов сравниваем содержимое
      if (Array.isArray(oldValue) && Array.isArray(newValue)) {
        return JSON.stringify(oldValue.sort()) !== JSON.stringify(newValue.sort());
      }
      
      return oldValue !== newValue;
    });
  };

  const loadCalendar = async (opts = {}) => {
    const { background = false } = opts;
    if (!user?.token || !petIdStr) return;

    try {
      if (!background) setLoading(true);
      const response = await fetch(`/api/pet-care/calendar/${petIdStr}`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });

      if (response.status === 404) {
        // Календарь не существует, создаем его
        await createCalendar();
        return;
      }

      if (!response.ok) throw new Error('Failed to load calendar');

      const data = await response.json();
      const events = Array.isArray(data.events) ? data.events : [];
      setCalendar({ ...data, events });
      
      // Загружаем данные питомца для сравнения при обновлениях
      await loadPetData();
    } catch (err) {
      setError(err.message);
    } finally {
      if (!background) setLoading(false);
    }
  };

  const createCalendar = async () => {
    if (!user?.token || !petIdStr) return;
    try {
      setError(null);
      const response = await fetch(`/api/pet-care/calendar/${petIdStr}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data.details || data.error || 'Не удалось создать календарь';
        throw new Error(typeof msg === 'string' ? msg : 'Не удалось создать календарь');
      }

      await loadCalendar({ background: true });
      setSuccMessage('Календарь создан. Для персонализации через AI нажмите «AI-календарь».');
      setTimeout(() => setSuccMessage(''), 6000);
    } catch (err) {
      const m = err.message || '';
      setError(m.includes('Failed to fetch') || m.includes('NetworkError')
        ? 'Нет связи с сервером. Убедитесь, что backend запущен (порт 4000), и попробуйте снова.'
        : m);
    }
  };

  const handleAddEvent = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`/api/pet-care/calendar/${petIdStr}/events`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newEvent)
      });

      if (!response.ok) throw new Error('Failed to add event');

      setShowAddEvent(false);
      setNewEvent({
        type: 'custom',
        title: '',
        date: new Date().toISOString().split('T')[0],
        priority: 'medium',
        description: ''
      });
      await loadCalendar();
    } catch (err) {
      setError(err.message);
    }
  };

  const completeEvent = async (eventId, eventDate) => {
    try {
      const response = await fetch(
        `/api/pet-care/calendar/${petIdStr}/events/${eventId}/complete`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${user.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            notes: '',
            eventDate: eventDate // Передаем дату события для повторяющихся событий
          })
        }
      );

      if (!response.ok) throw new Error('Failed to complete event');

      const data = await response.json();
      // Обновляем календарь из ответа сервера
      if (data.calendar) {
        setCalendar(data.calendar);
      } else {
        // Если календарь не в ответе, перезагружаем
        await loadCalendar();
      }
      
      return data.calendar;
    } catch (err) {
      setError(err.message);
      return null;
    }
  };

  const editEvent = (event) => {
    setEventToEdit(event);
    setEditEventData({
      type: event.type,
      title: event.title,
      date: event.date.split('T')[0],
      priority: event.priority,
      description: event.description || ''
    });
    setShowEditEvent(true);
  };

  const handleUpdateEvent = async (e) => {
    e.preventDefault();
    if (!eventToEdit) return;

    try {
      const response = await fetch(
        `/api/pet-care/calendar/${petIdStr}/events/${eventToEdit._id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${user.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(editEventData)
        }
      );

      if (!response.ok) throw new Error('Failed to update event');

      setShowEditEvent(false);
      setEventToEdit(null);
      await loadCalendar();
      setSuccMessage('Событие успешно обновлено');
      setTimeout(() => setSuccMessage(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteEvent = async (eventId) => {
    const event = calendar?.events?.find(e => e._id === eventId);
    setEventToDelete(event);
    setShowDeleteConfirm(true);
  };

  const handleDayClick = (day, dayEvents) => {
    if (dayEvents.length > 0) {
      setSelectedDay(day);
      setSelectedDayEvents(dayEvents);
      setShowDayEventsModal(true);
    }
  };

  const confirmDelete = async () => {
    if (!eventToDelete) return;

    try {
      const response = await fetch(
        `/api/pet-care/calendar/${petIdStr}/events/${eventToDelete._id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${user.token}`
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || 'Не удалось удалить событие');
      }

      setShowDeleteConfirm(false);
      setEventToDelete(null);
      await loadCalendar();
      setSuccMessage('Событие успешно удалено');
      setTimeout(() => setSuccMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Не удалось удалить событие');
      setShowDeleteConfirm(false);
      setEventToDelete(null);
    }
  };

  const getFilteredEvents = () => {
    if (!calendar?.events) return [];

    // Сравниваем только по дате, чтобы "ежедневные" задания на текущий день
    // не пропадали из "Предстоящие" из-за текущего времени суток.
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const filtered = calendar.events.filter(event => {
      const eventDate = new Date(event.date);
      eventDate.setHours(0, 0, 0, 0);
      
      switch (filter) {
        case 'upcoming':
          if (event.completed) return false;
          // Разовые — по дате; повторяющиеся — если сегодня/выбранный день входит в серию
          return (
            eventDate >= todayStart ||
            (event.recurring?.enabled && eventOccursOnDay(event, todayStart))
          );
        case 'overdue':
          if (event.completed) return false;
          // Ежедневные и еженедельные повторяющиеся не показываем — слишком много экземпляров
          if (event.recurring?.enabled &&
              (event.recurring.interval === 'daily' || event.recurring.interval === 'day' ||
               event.recurring.interval === 'weekly' || event.recurring.interval === 'week')) return false;
          return eventDate < todayStart;
        case 'completed':
          return event.completed;
        default:
          return true;
      }
    });

    // Список: показываем самые новые события первыми
    // - для выполненных сортируем по completedAt (если есть), иначе по date
    // - для предстоящих/просроченных/всех сортируем по date
    const getSortTime = (e) => {
      const raw = filter === 'completed' ? (e.completedAt || e.date) : e.date;
      const t = new Date(raw).getTime();
      return Number.isFinite(t) ? t : 0;
    };

    return filtered.sort((a, b) => getSortTime(b) - getSortTime(a));
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    // Проверяем, что дата валидна
    if (isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const getEventIcon = (type) => {
    const icons = {
      vaccination: '💉',
      vet_checkup: '🏥',
      grooming: '✂️',
      deworming: '💊',
      flea_treatment: '🪲',
      nail_trimming: '✂️',
      teeth_cleaning: '🦷',
      feeding_schedule: '🍽️',
      exercise: '🏃',
      medication: '💊',
      custom: '📝'
    };
    return icons[type] || '';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: '#42a5f5',      // Голубой
      medium: '#651fff',   // Фиолетовый
      high: '#7c4dff',     // Яркий фиолетовый
      urgent: '#9c27b0'    // Темно-фиолетовый
    };
    return colors[priority] || '#6504b5';
  };

  const getPriorityLabel = (priority) => {
    const labels = {
      low: 'Низкий',
      medium: 'Средний',
      high: 'Высокий',
      urgent: 'Срочный'
    };
    return labels[priority] || priority;
  };

  const getEventTypeColor = (type) => {
    const colors = {
      vaccination: '#9c27b0',      // Фиолетовый
      vet_checkup: '#2196f3',       // Синий
      grooming: '#7b1fa2',         // Темно-фиолетовый
      deworming: '#5c6bc0',        // Индиго
      flea_treatment: '#3949ab',    // Темно-синий
      nail_trimming: '#7986cb',     // Светло-фиолетовый
      teeth_cleaning: '#42a5f5',    // Голубой
      feeding_schedule: '#651fff',  // Яркий фиолетовый
      exercise: '#3f51b5',          // Индиго
      medication: '#7c4dff',        // Фиолетовый
      custom: '#9575cd'             // Светло-фиолетовый
    };
    return colors[type] || '#6504b5';
  };

  // Функция для получения дней месяца
  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    // Добавляем пустые ячейки для выравнивания
    for (let i = 0; i < (startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1); i++) {
      days.push(null);
    }
    // Добавляем дни месяца
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    return days;
  };

  // События на день: разовые — по дате; повторяющиеся — виртуально на каждый подходящий день
  const getEventsForDay = (date) => {
    if (!date || !calendar?.events) return [];
    
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    return calendar.events.filter(event => eventOccursOnDay(event, targetDate));
  };

  // Навигация по месяцам
  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  const loadAnalytics = async () => {
    if (!user?.token || analytics) return;

    try {
      setAnalyticsLoading(true);
      const response = await fetch(`/api/pet-care/calendar/${petIdStr}/analytics`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });

      if (!response.ok) throw new Error('Failed to load analytics');

      const data = await response.json();
      setAnalytics(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    if (showAnalytics && !analytics) {
      loadAnalytics();
    }
  }, [showAnalytics]);

  const handleRegenerateCalendar = () => {
    setShowRegenerateConfirm(true);
  };

  const confirmRegenerate = async () => {
    try {
      setRegenerating(true);
      setShowRegenerateConfirm(false);
      
      const response = await fetch(`/api/pet-care/calendar/${petIdStr}/regenerate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });

      if (!response.ok) throw new Error('Failed to regenerate calendar');

      await response.json();
      // Повторная загрузка через GET: актуальные stats, даты и развёрнутые повторяющиеся события
      await loadCalendar({ background: true });
      
      // Показываем уведомление об успехе
      setSuccMessage('Календарь успешно перегенерирован! AI создал новые события на основе данных о питомце.');
      setTimeout(() => setSuccMessage(''), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return <div className="calendar-loading">Загрузка календаря...</div>;
  }

  if (error) {
    return <div className="calendar-error">Ошибка: {error}</div>;
  }

  if (!calendar) {
    return (
      <div className="calendar-empty">
        <p>Календарь не найден</p>
        <button onClick={createCalendar} className="btn-create-calendar">
          Создать календарь ухода
        </button>
      </div>
    );
  }

  const filteredEvents = getFilteredEvents();

  return (
    <div className="pet-care-calendar">
      <div className="calendar-header">
        <h2>Календарь ухода: {petName}</h2>
        {calendar.events && calendar.events.length > 0 && (
          <div className="ai-badge">
            <AIRobotIcon size={16} variant="onDark" decorative />
            <span>События созданы с помощью AI</span>
          </div>
        )}
        <div className="calendar-stats">
          <div className="stat">
            <span className="stat-value">{calendar.stats.totalEvents}</span>
            <span className="stat-label">Всего</span>
          </div>
          <div className="stat">
            <span className="stat-value">{calendar.stats.upcomingEvents}</span>
            <span className="stat-label">Предстоящих</span>
          </div>
          <div className="stat stat-overdue">
            <span className="stat-value stat-value-overdue">{calendar.stats.overdueEvents}</span>
            <span className="stat-label">Просрочено</span>
          </div>
          <div className="stat">
            <span className="stat-value">{calendar.stats.completedEvents}</span>
            <span className="stat-label">Выполнено</span>
          </div>
        </div>
      </div>

      {/* Переключатель видов */}
      <div className="view-mode-switcher">
        <div className="action-buttons">
          <button 
            className="btn-add-event"
            onClick={() => setShowAddEvent(true)}
          >
            + Добавить событие
          </button>
          <button 
            className="btn-analytics"
            onClick={() => {
              setShowAnalytics(true);
              loadAnalytics();
            }}
            title="Аналитика"
          >
            Аналитика
          </button>
          <button 
            className="btn-regenerate"
            onClick={handleRegenerateCalendar}
            title="Перегенерировать календарь с AI"
            disabled={regenerating}
          >
            {regenerating ? 'Генерация...' : 'AI-календарь'}
          </button>
        </div>
        <div className="view-mode-indicator">
          <span className="view-mode-label">Режим просмотра:</span>
        <div className="view-buttons">
          <button
            className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            title="Список"
          >
              <span className="view-icon">≡</span>
              <span className="view-text">Список</span>
          </button>
          <button
            className={`view-btn ${viewMode === 'calendar' ? 'active' : ''}`}
            onClick={() => setViewMode('calendar')}
            title="Календарь"
          >
              <span className="view-icon">☰</span>
              <span className="view-text">Календарь</span>
          </button>
          </div>
        </div>
      </div>

      <div className="calendar-filters">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Все события
        </button>
        <button
          className={`filter-btn ${filter === 'upcoming' ? 'active' : ''}`}
          onClick={() => setFilter('upcoming')}
        >
          Предстоящие
        </button>
        <button
          className={`filter-btn ${filter === 'overdue' ? 'active' : ''}`}
          onClick={() => setFilter('overdue')}
        >
          Просроченные
        </button>
        <button
          className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
          onClick={() => setFilter('completed')}
        >
          Выполненные
        </button>
      </div>

      {/* Сообщение об успехе */}
      {succMessage && (
        <div className="success-message">
          {succMessage}
        </div>
      )}

      {/* Модальное окно подтверждения удаления */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-content confirm-modal">
            <div className="modal-header">
              <h3>Удаление события</h3>
              <button className="btn-close" onClick={() => {
                setShowDeleteConfirm(false);
                setEventToDelete(null);
              }}>×</button>
            </div>
            <div className="confirm-content">
              <p>Вы уверены, что хотите удалить событие <strong>"{eventToDelete?.title}"</strong>?</p>
              <p className="confirm-warning">Это действие нельзя отменить.</p>
            </div>
            <div className="confirm-actions">
              <button
                className="btn-confirm-delete"
                onClick={confirmDelete}
              >
                Удалить
              </button>
              <button
                className="btn-cancel"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setEventToDelete(null);
                }}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно подтверждения перегенерации */}
      {showRegenerateConfirm && (
        <div className="modal-overlay">
          <div className="modal-content confirm-modal">
            <div className="modal-header">
              <h3>Перегенерация календаря</h3>
              <button className="btn-close" onClick={() => setShowRegenerateConfirm(false)}>×</button>
            </div>
            <div className="confirm-content">
              <p>Перегенерировать календарь с помощью AI?</p>
              <p className="confirm-warning">Существующие AI-события будут заменены новыми на основе актуальных данных о питомце.</p>
            </div>
            <div className="confirm-actions">
              <button
                className="btn-confirm-regenerate"
                onClick={confirmRegenerate}
                disabled={regenerating}
              >
                {regenerating ? '⏳ Генерация...' : '🔄 Перегенерировать'}
              </button>
              <button
                className="btn-cancel"
                onClick={() => setShowRegenerateConfirm(false)}
                disabled={regenerating}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Уведомление о необходимости перегенерации календаря */}
      {showRegeneratePrompt && (
        <div className="regenerate-prompt-overlay">
          <div className="regenerate-prompt">
            <div className="prompt-header">
              <h3>Данные питомца обновлены</h3>
              <button className="btn-close" onClick={() => setShowRegeneratePrompt(false)}>×</button>
            </div>
            <div className="prompt-content">
              <p>Обнаружены изменения в данных питомца, которые могут повлиять на календарь ухода:</p>
              <ul>
                <li>Вид, порода или возраст</li>
                <li>Медицинские заметки</li>
                <li>Характеристики ухода</li>
              </ul>
              <p>Рекомендуется перегенерировать календарь для актуальных рекомендаций.</p>
            </div>
            <div className="prompt-actions">
              <button
                className="btn-regenerate-now"
                onClick={() => {
                  setShowRegeneratePrompt(false);
                  setShowRegenerateConfirm(true);
                }}
                disabled={regenerating}
              >
                {regenerating ? '⏳ Генерация...' : '🔄 Перегенерировать сейчас'}
              </button>
              <button
                className="btn-regenerate-later"
                onClick={() => setShowRegeneratePrompt(false)}
              >
                Позже
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно аналитики */}
      {showAnalytics && (
        <div className="modal-overlay">
          <div className="modal-content analytics-modal">
            <div className="modal-header">
              <h3>AI-аналитика календаря</h3>
              <button className="btn-close" onClick={() => setShowAnalytics(false)}>×</button>
            </div>
            <div className="analytics-content">
              {analyticsLoading ? (
                <div className="loading">Загрузка аналитики...</div>
              ) : analytics ? (
                <>
                  {analytics.insights && analytics.insights.length > 0 && (
                    <div className="analytics-insights">
                      <h4>Анализ:</h4>
                      {analytics.insights.map((insight, idx) => (
                        <p key={idx}>{insight}</p>
                      ))}
                    </div>
                  )}
                  {analytics.recommendations && analytics.recommendations.length > 0 && (
                    <div className="analytics-recommendations">
                      <h4>Рекомендации:</h4>
                      <ul>
                        {analytics.recommendations.map((rec, idx) => (
                          <li key={idx} className={`recommendation-${rec.priority || 'medium'}`}>
                            {rec.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <div className="no-analytics">Аналитика недоступна</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно добавления события */}
      {showAddEvent && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Новое событие</h3>
                <button className="btn-close" onClick={() => setShowAddEvent(false)}>×</button>
              </div>
              <div className="modal-content-scrollable" ref={addEventModalContentRef}>
                <form onSubmit={handleAddEvent} className="add-event-form" ref={addEventFormRef}>
                <div className="form-group form-group-title">
                  <label>Название события *</label>
                  <input
                    type="text"
                    required
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                    placeholder="Например: Прием у ветеринара"
                    autoFocus
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Тип события</label>
                    <StyledSelect
                      id="add-event-type"
                      value={newEvent.type}
                      onChange={(v) => setNewEvent({ ...newEvent, type: v })}
                      options={CARE_EVENT_TYPE_OPTIONS}
                      aria-label="Тип события"
                    />
                  </div>
                  <div className="form-group">
                    <label>Дата *</label>
                    <input
                      type="date"
                      required
                      value={newEvent.date}
                      onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Описание *</label>
                  <textarea
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                    rows="3"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Приоритет *</label>
                  <StyledSelect
                    id="add-event-priority"
                    value={newEvent.priority}
                    onChange={(v) => setNewEvent({ ...newEvent, priority: v })}
                    options={CARE_PRIORITY_OPTIONS}
                    required
                    aria-label="Приоритет"
                  />
                </div>
                <div className="form-actions">
                  <button type="button" className="btn-cancel" onClick={() => setShowAddEvent(false)}>
                    Отмена
                  </button>
                  <button type="submit" className="btn-submit">Добавить</button>
                </div>
              </form>
              </div>
            </div>
          </div>
      )}

      {/* Модальное окно редактирования события */}
      {showEditEvent && eventToEdit && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Редактировать событие</h3>
              <button className="btn-close" onClick={() => {
                setShowEditEvent(false);
                setEventToEdit(null);
              }}>×</button>
            </div>
            <form onSubmit={handleUpdateEvent} className="add-event-form" ref={editEventFormRef}>
              <div className="form-group form-group-title">
                <label>Название события *</label>
                <input
                  type="text"
                  required
                  value={editEventData.title}
                  onChange={(e) => setEditEventData({...editEventData, title: e.target.value})}
                  placeholder="Например: Прием у ветеринара"
                  autoFocus
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Тип события</label>
                  <StyledSelect
                    id="edit-event-type"
                    value={editEventData.type}
                    onChange={(v) => setEditEventData({ ...editEventData, type: v })}
                    options={CARE_EVENT_TYPE_OPTIONS}
                    aria-label="Тип события"
                  />
                </div>
                <div className="form-group">
                  <label>Дата</label>
                  <input
                    type="date"
                    required
                    value={editEventData.date}
                    onChange={(e) => setEditEventData({...editEventData, date: e.target.value})}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Описание</label>
                <textarea
                  value={editEventData.description}
                  onChange={(e) => setEditEventData({...editEventData, description: e.target.value})}
                  rows="3"
                />
              </div>
              <div className="form-group">
                <label>Приоритет</label>
                <StyledSelect
                  id="edit-event-priority"
                  value={editEventData.priority}
                  onChange={(v) => setEditEventData({ ...editEventData, priority: v })}
                  options={CARE_PRIORITY_OPTIONS}
                  aria-label="Приоритет"
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => {
                  setShowEditEvent(false);
                  setEventToEdit(null);
                }}>
                  Отмена
                </button>
                <button type="submit" className="btn-submit">Сохранить изменения</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно просмотра всех событий дня */}
      {showDayEventsModal && selectedDay && (
        <div className="modal-overlay">
          <div className="modal-content day-events-modal">
            <div className="modal-header">
              <h3>События на {formatDate(selectedDay.toISOString())}</h3>
              <button className="btn-close" onClick={() => {
                setShowDayEventsModal(false);
                setSelectedDay(null);
                setSelectedDayEvents([]);
              }}>×</button>
            </div>
            <div className="day-events-list">
              {selectedDayEvents.length === 0 ? (
                <p className="no-events-text">Нет событий на этот день</p>
              ) : (
                selectedDayEvents.map(event => (
                  <div
                    key={event._id}
                    className={`day-event-card ${event.completed ? 'completed' : ''} ${
                      new Date(event.date) < new Date() && !event.completed ? 'overdue' : ''
                    }`}
                  >
                    <div className="day-event-icon">{getEventIcon(event.type)}</div>
                    <div className="day-event-content">
                      <div className="day-event-header">
                        <h4 className="day-event-title">{event.title}</h4>
                        <span
                          className="day-event-priority"
                          style={{ backgroundColor: getPriorityColor(event.priority) }}
                        >
                          {getPriorityLabel(event.priority)}
                        </span>
                      </div>
                      {event.description && (
                        <p className="day-event-description">{event.description}</p>
                      )}
                      {event.completed && event.completedAt && (
                        <span className="day-event-completed">
                          Выполнено {formatDate(event.completedAt)}
                        </span>
                      )}
                    </div>
                    <div className="day-event-actions">
                      {!event.completed && (
                        <button
                          className="btn-complete-small"
                          onClick={async () => {
                            const updatedCalendar = await completeEvent(event._id, event.date);
                            // Обновляем события в модальном окне из обновленного календаря
                            if (selectedDay) {
                              const updatedDayEvents = updatedCalendar 
                                ? updatedCalendar.events.filter(e =>
                                    eventOccursOnDay(e, selectedDay)
                                  )
                                : getEventsForDay(selectedDay);
                              setSelectedDayEvents(updatedDayEvents);
                            }
                          }}
                          title="Отметить как выполненное"
                        >
                          ✓
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Отображение в зависимости от выбранного режима */}
      {viewMode === 'list' ? (
        <div className="calendar-events">
          {filteredEvents.length === 0 ? (
            <div className="no-events">
              <p>Нет событий в этой категории</p>
            </div>
          ) : (
            filteredEvents.map(event => (
            <div
              key={event._id}
              className={`event-card ${event.completed ? 'completed' : ''} ${
                new Date(event.date) < new Date() && !event.completed ? 'overdue' : ''
              }`}
            >
              <div className="event-icon">{getEventIcon(event.type)}</div>
              <div className="event-content">
                <div className="event-header">
                  <h3 className="event-title">{event.title}</h3>
                  <span
                    className="event-priority"
                    style={{ backgroundColor: getPriorityColor(event.priority) }}
                  >
                    {getPriorityLabel(event.priority)}
                  </span>
                </div>
                <p className="event-description">{event.description}</p>
                <div className="event-meta">
                  <span className="event-date">📅 {formatDate(event.date)}</span>
                  {event.recurring?.enabled && (
                    <span className="event-recurring">
                      🔄 Повторяется {event.recurring.interval === 'daily' || event.recurring.interval === 'day' ? 'ежедневно' :
                                      event.recurring.interval === 'weekly' || event.recurring.interval === 'week' ? 'еженедельно' : 
                                      event.recurring.interval === 'monthly' || event.recurring.interval === 'month' ? 'ежемесячно' : 
                                      event.recurring.interval === 'yearly' || event.recurring.interval === 'year' ? 'ежегодно' : 'регулярно'}
                    </span>
                  )}
                  {event.completed && (
                    <span className="event-completed-at">
                      Выполнено {event.completedAt ? formatDate(event.completedAt) : ''}
                    </span>
                  )}
                </div>
                {event.notes && (
                  <div className="event-notes">
                    <strong>Заметки:</strong> {event.notes}
                  </div>
                )}
              </div>
              <div className="event-actions">
                {!event.completed && (
                  <button
                    className="btn-complete"
                    onClick={() => completeEvent(event._id, event.date)}
                    title="Отметить как выполненное"
                  >
                    ✓
                  </button>
                )}
                <button
                  className="btn-edit"
                  onClick={() => editEvent(event)}
                  title="Редактировать"
                >
                  ✏️
                </button>
                <button
                  className="btn-delete"
                  onClick={() => deleteEvent(event._id)}
                  title="Удалить"
                >
                  🗑️
                </button>
              </div>
            </div>
            ))
          )}
        </div>
      ) : (
        /* Календарный вид */
        <div className="calendar-view">
          <div className="calendar-navigation">
            <button className="nav-btn" onClick={previousMonth}>‹</button>
            <div className="current-month">
              <h3>
                {currentMonth.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
              </h3>
              <button className="btn-today" onClick={goToToday}>Сегодня</button>
            </div>
            <button className="nav-btn" onClick={nextMonth}>›</button>
          </div>

          <div className="calendar-grid">
            <div className="calendar-weekdays">
              <div className="weekday">Пн</div>
              <div className="weekday">Вт</div>
              <div className="weekday">Ср</div>
              <div className="weekday">Чт</div>
              <div className="weekday">Пт</div>
              <div className="weekday">Сб</div>
              <div className="weekday">Вс</div>
            </div>
            
            <div className="calendar-days">
              {getDaysInMonth().map((day, index) => {
                if (!day) {
                  return <div key={`empty-${index}`} className="calendar-day empty"></div>;
                }
                
                const dayEvents = getEventsForDay(day);
                const isToday = day.toDateString() === new Date().toDateString();
                const hasOverdue = dayEvents.some(e => !e.completed && new Date(e.date) < new Date());
                
                return (
                  <div 
                    key={day.toISOString()} 
                    className={`calendar-day ${isToday ? 'today' : ''} ${hasOverdue ? 'has-overdue' : ''} ${dayEvents.length > 0 ? 'has-events' : ''} ${dayEvents.length > 3 ? 'has-many-events' : ''}`}
                    onClick={() => dayEvents.length > 0 && handleDayClick(day, dayEvents)}
                    style={{ cursor: dayEvents.length > 0 ? 'pointer' : 'default' }}
                  >
                    <div className="day-number">{day.getDate()}</div>
                    <div className="day-events">
                      {dayEvents.slice(0, 3).map(event => (
                        <div
                          key={event._id}
                          className={`day-event ${event.completed ? 'completed' : ''}`}
                          style={{ 
                            backgroundColor: getEventTypeColor(event.type),
                            opacity: event.completed ? 0.5 : 1
                          }}
                          title={`${event.title} - ${event.description || ''}`}
                        >
                          <span className="event-icon-small">{getEventIcon(event.type)}</span>
                          <span className="event-title-small">{event.title}</span>
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="more-events" title="Нажмите, чтобы увидеть все события">+{dayEvents.length - 3}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Легенда типов событий */}
          <div className="event-legend">
            <h4>Типы событий:</h4>
            <div className="legend-items">
              <div className="legend-item">
                <span className="legend-color" style={{ backgroundColor: getEventTypeColor('vaccination') }}></span>
                <span>Прививка</span>
              </div>
              <div className="legend-item">
                <span className="legend-color" style={{ backgroundColor: getEventTypeColor('vet_checkup') }}></span>
                <span>Ветеринар</span>
              </div>
              <div className="legend-item">
                <span className="legend-color" style={{ backgroundColor: getEventTypeColor('grooming') }}></span>
                <span>Груминг</span>
              </div>
              <div className="legend-item">
                <span className="legend-color" style={{ backgroundColor: getEventTypeColor('medication') }}></span>
                <span>Лекарства</span>
              </div>
              <div className="legend-item">
                <span className="legend-color" style={{ backgroundColor: getEventTypeColor('exercise') }}></span>
                <span>Активность</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PetCareCalendar;

