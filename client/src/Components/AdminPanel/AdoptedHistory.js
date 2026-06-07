import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthContext } from '../../hooks/UseAuthContext';
import { format, parseISO, parse, differenceInDays, startOfMonth } from 'date-fns';
import { ru } from 'date-fns/locale';
import axios from 'axios';
import './AdoptedHistory.css';
import { getPetImageUrl } from '../../utils/petImageUrl';

const AdoptedHistory = () => {
  const [adoptedPets, setAdoptedPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user, dispatch } = useAuthContext();
  
  // Состояние фильтров
  const [filters, setFilters] = useState({
    period: 'all',
    searchTerm: '',
    species: []
  });
  
  // Определение периодов для фильтрации (в useMemo для оптимизации)
  const periods = useMemo(() => [
    { id: 'all', label: 'За все время' },
    { id: 'week', label: 'За неделю', days: 7 },
    { id: 'month', label: 'За последние 30 дней', days: 30 },
    { id: '3months', label: 'За 3 месяца', days: 90 },
    { id: '6months', label: 'За 6 месяца', days: 180 },
    { id: 'year', label: 'За год', days: 365 }
  ], []);

  // Получение данных с сервера
  const fetchAdoptedPets = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin-pets/adoptedPets', {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      });
      
      // Handle token expiration
      if (response.status === 401) {
        // Try to refresh the token
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
            return fetchAdoptedPets();
          }
        } catch (refreshError) {
          console.error('Failed to refresh token:', refreshError);
          throw new Error('Authentication failed - please login again');
        }
      }
      
      if (!response.ok) {
        throw new Error('Не удалось загрузить данные усыновленных питомцев');
      }
      
      const data = await response.json();
      setAdoptedPets(data);
      setError(null);
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
      setError('Не удалось загрузить усыновленных питомцев');
    } finally {
      setLoading(false);
    }
  }, [dispatch, user]);

  // Загрузка данных при монтировании компонента
  useEffect(() => {
    fetchAdoptedPets();
  }, [fetchAdoptedPets]);

  // Обработчик изменения фильтров
  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  // Фильтрация питомцев по периодам и другим критериям
  const filteredPets = useMemo(() => {
    return adoptedPets.filter(pet => {
      // Проверка периода
      if (filters.period !== 'all') {
        const currentPeriod = periods.find(p => p.id === filters.period);
        if (currentPeriod) {
          const adoptedDate = new Date(pet.updatedAt);
          const today = new Date();
          const diffDays = differenceInDays(today, adoptedDate);
          
          if (diffDays > currentPeriod.days) {
            return false;
          }
        }
      }
      
      // Проверка видов животных
      if (filters.species.length > 0 && !filters.species.includes(pet.species)) {
        return false;
      }
      
      // Поиск по ключевому слову
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const nameMatch = pet.name.toLowerCase().includes(searchLower);
        const breedMatch = pet.breed.toLowerCase().includes(searchLower);
        const emailMatch = pet.adopter_email && pet.adopter_email.toLowerCase().includes(searchLower);
        
        return nameMatch || breedMatch || emailMatch;
      }
      
      return true;
    });
  }, [adoptedPets, filters, periods]);

  // Получение уникальных видов животных для фильтрации
  const uniqueSpecies = useMemo(() => {
    return [...new Set(adoptedPets.map(pet => pet.species))];
  }, [adoptedPets]);

  // Группировка по календарному месяцу усыновления; подпись — LLLL (именительный), не MMMM («марта» в заголовке)
  const petsByMonth = useMemo(() => {
    const grouped = new Map();

    filteredPets.forEach((pet) => {
      const date = parseISO(pet.updatedAt);
      if (Number.isNaN(date.getTime())) return;
      const key = format(startOfMonth(date), 'yyyy-MM');
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(pet);
    });

    return [...grouped.entries()]
      .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
      .map(([key, pets]) => {
        const monthStart = parse(`${key}-01`, 'yyyy-MM-dd', new Date());
        const label = format(monthStart, 'LLLL yyyy', { locale: ru });
        return [label, pets];
      });
  }, [filteredPets]);

  // Очистка всех фильтров
  const clearAllFilters = () => {
    setFilters({
      period: 'all',
      searchTerm: '',
      species: []
    });
  };

  // Форматирование даты усыновления
  const formatAdoptionDate = (dateString) => {
    const date = new Date(dateString);
    return format(date, 'd MMMM yyyy', { locale: ru });
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Загрузка истории усыновлений...</p>
      </div>
    );
  }

  return (
    <div className="adoption-history-container">
      <div className="adoption-header">
        <div className="header-icon" aria-hidden="true">
          <AdoptionHistoryHeaderIcon />
        </div>
        <h1>История усыновлений</h1>
        <p className="header-description">
          Здесь представлены все успешно усыновленные питомцы с информацией о новых владельцах
        </p>
      </div>
      
      {/* Фильтр по периодам */}
      <div className="petfinder-filter-container">
        <div className="filter-header">
          <h2>Фильтр истории усыновлений</h2>
          <button 
            className="reset-filter-btn" 
            onClick={clearAllFilters}
          >
            Очистить все фильтры
          </button>
        </div>
        
        {/* Поиск */}
        <div className="search-container">
          <input
            type="text"
            value={filters.searchTerm}
            onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
            placeholder="Поиск по имени, породе или email..."
            className="search-input"
          />
          <span className="search-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
              <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </span>
        </div>
        
        <div className="filter-grid">
          {/* Фильтр по периоду */}
          <div className="filter-card">
            <h3>Период усыновления</h3>
            <div className="period-buttons">
              {periods.map(period => (
                <button
                  key={period.id}
                  className={`period-button ${filters.period === period.id ? 'active' : ''}`}
                  onClick={() => handleFilterChange('period', period.id)}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Фильтр по виду животного */}
          <div className="filter-card">
            <h3>Вид животного</h3>
            <div className="type-buttons">
              {uniqueSpecies.map(species => (
                <button
                  key={species}
                  className={`type-button ${filters.species.includes(species) ? 'active' : ''}`}
                  onClick={() => {
                    if (filters.species.includes(species)) {
                      handleFilterChange('species', 
                        filters.species.filter(s => s !== species)
                      );
                    } else {
                      handleFilterChange('species', [...filters.species, species]);
                    }
                  }}
                >
                  {species}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Активные фильтры */}
        {(filters.period !== 'all' || filters.species.length > 0 || filters.searchTerm) && (
          <div className="active-filters">
            <span className="active-filters-title">Активные фильтры:</span>
            <div className="filter-tags">
              {filters.period !== 'all' && (
                <span className="filter-tag">
                  {periods.find(p => p.id === filters.period).label}
                  <button onClick={() => handleFilterChange('period', 'all')}>×</button>
                </span>
              )}
              
              {filters.species.map(species => (
                <span key={species} className="filter-tag">
                  {species}
                  <button onClick={() => {
                    handleFilterChange('species', 
                      filters.species.filter(s => s !== species)
                    );
                  }}>×</button>
                </span>
              ))}
              
              {filters.searchTerm && (
                <span className="filter-tag">
                  Поиск: {filters.searchTerm}
                  <button onClick={() => handleFilterChange('searchTerm', '')}>×</button>
                </span>
              )}
            </div>
          </div>
        )}
      </div>
      
      {error ? (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={fetchAdoptedPets} className="retry-button">
            Попробовать снова
          </button>
        </div>
      ) : filteredPets.length === 0 ? (
        <div className="no-adopted-pets">
          <div className="no-pets-icon">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.703 1.725 1.722 3.656 1 1.261-.472 1.96-1.45 2.344-2.5" stroke="#6504b5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14.267 5.172c0-1.39 1.577-2.493 3.5-2.172 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5" stroke="#6504b5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 14v.5M16 14v.5M11.25 16.25h1.5L12 17l-.75-.75z" stroke="#6504b5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444c0-1.061-.162-2.2-.493-3.309m-9.243-6.082A8.801 8.801 0 0 1 12 5c.78 0 1.5.108 2.161.306" stroke="#6504b5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2>Нет усыновленных питомцев</h2>
          <p>За выбранный период не найдено усыновленных питомцев</p>
        </div>
      ) : (
        // Отображение по месяцам
        <div className="pets-by-month-container">
          {petsByMonth.map(([month, pets]) => (
            <div key={month} className="month-section">
              <h2 className="month-heading">{month}</h2>
              <div className="pets-grid">
                {pets.map(pet => (
                  <div key={pet._id} className="pet-card">
                    <div className="pet-image">
                      <img 
                        src={getPetImageUrl(pet.filename)} 
                        alt={pet.name}
                        onError={(e) => {
                          e.target.src = "/api/images/default.jpg";
                        }} 
                      />
                      <div className="adopted-badge">Усыновлен</div>
                    </div>
                    <div className="pet-info">
                      <h3>{pet.name}</h3>
                      <p className="pet-breed">{pet.species}, {pet.breed}</p>
                      <p className="adoption-date">
                        <span className="label">Дата усыновления:</span>
                        <span className="date">{formatAdoptionDate(pet.updatedAt)}</span>
                      </p>
                      <div className="adopter-info">
                        <p className="adopter-email">
                          <span className="label">Email:</span>
                          <span>{pet.adopter_email || pet.email}</span>
                        </p>
                        <p className="adopter-phone">
                          <span className="label">Телефон:</span>
                          <span>{pet.phone}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/** Голова кошки — белая на фиолетовом круге (AdoptedHistory.css) */
const AdoptionHistoryHeaderIcon = () => (
  <svg width="38" height="38" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      fill="currentColor"
      d="M9.6 2.35 7.45 7.85C5.1 8.7 4 10.75 4 13.2v4.6C4 20.1 5.85 22 8.15 22h7.7C18.15 22 20 20.1 20 17.8v-4.6c0-2.45-1.1-4.5-3.45-5.35L14.4 2.35 12 4.55 9.6 2.35z"
    />
    <circle cx="9.15" cy="13.85" r="1.2" fill="#2d1b4e" />
    <circle cx="14.85" cy="13.85" r="1.2" fill="#2d1b4e" />
    <path fill="#2d1b4e" d="M12 15.35l.85 1.1h-1.7z" />
  </svg>
);

export default AdoptedHistory;
