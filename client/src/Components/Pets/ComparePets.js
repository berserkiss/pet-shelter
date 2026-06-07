import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthContext } from '../../hooks/UseAuthContext';
import io from 'socket.io-client';
import { getSocketServerUrl } from '../../utils/socketServerUrl';
import { getPetImageUrl } from '../../utils/petImageUrl';
import AIRobotIcon from '../icons/AIRobotIcon';
import './ComparePets.css';

const LABELS = {
  status: 'Статус',
  name: 'Имя',
  species: 'Вид',
  breed: 'Порода',
  size: 'Размер',
  energyLevel: 'Энергичность',
  careLevel: 'Уход',
  activityNeeds: 'Потребность в активности',
  temperamentTraits: 'Черты характера',
  isKidFriendly: 'Дружелюбен к детям',
  isPetFriendly: 'Дружелюбен к животным',
  hypoallergenic: 'Гипоаллергенный',
  area: 'Город',
  shelter: 'Приют',
  birthDate: 'Возраст'
};

const SIZE_LABELS = { small: 'Маленький', medium: 'Средний', large: 'Крупный', giant: 'Очень крупный' };
const ENERGY_LABELS = { low: 'Низкая', medium: 'Средняя', high: 'Высокая' };
const CARE_LABELS = { low: 'Лёгкий', medium: 'Средний', high: 'Сложный' };
const ACTIVITY_LABELS = { low: 'Низкая', moderate: 'Умеренная', high: 'Высокая' };

/** Строки таблицы, по которым считается «совпадение / всего» с предпочтениями */
const ROW_KEYS_FOR_SCORING = [
  'species',
  'breed',
  'size',
  'energyLevel',
  'careLevel',
  'activityNeeds',
  'temperamentTraits',
  'isKidFriendly',
  'isPetFriendly',
  'hypoallergenic',
  'area'
];

const TABLE_ROWS = [
  'status',
  'name',
  'species',
  'breed',
  'size',
  'energyLevel',
  'careLevel',
  'activityNeeds',
  'temperamentTraits',
  'isKidFriendly',
  'isPetFriendly',
  'hypoallergenic',
  'area',
  'shelter',
  'birthDate'
];

const hasMeaningfulPreferences = (p) => {
  if (!p || typeof p !== 'object') return false;
  const arrays = ['preferredSpecies', 'preferredBreeds', 'preferredSizes', 'preferredTemperaments', 'preferredCities'];
  if (arrays.some((f) => Array.isArray(p[f]) && p[f].length > 0)) return true;
  const strings = ['energyLevel', 'activityNeeds', 'activityLevel', 'careLevel', 'livingSpace'];
  if (strings.some((f) => typeof p[f] === 'string' && p[f].trim().length > 0)) return true;
  if (p.hasKids === true || p.hasOtherPets === true || p.allergyFriendly === true) return true;
  return false;
};

const normActivity = (v) => {
  if (!v) return '';
  const x = String(v).toLowerCase().trim();
  if (x === 'moderate') return 'medium';
  return x;
};

const formatAge = (birthDate) => {
  if (!birthDate) return '—';
  const birth = new Date(birthDate);
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (months < 0) months = 0;
  const years = Math.floor(months / 12);
  const m = months % 12;
  if (years > 0) {
    const yearWord = years === 1 ? 'год' : years < 5 ? 'года' : 'лет';
    return `${years} ${yearWord}` + (m > 0 ? ` ${m} мес.` : '');
  }
  const mesWord = months === 1 ? 'мес.' : months < 5 ? 'мес.' : 'мес.';
  return `${months} ${mesWord}`;
};

const getValue = (pet, key) => {
  switch (key) {
    case 'status':
      if (pet.status === 'Adopted') return 'Усыновлён';
      if (pet.status === 'Approved') return 'В каталоге';
      return pet.status || '—';
    case 'name':
      return pet.name || '—';
    case 'species':
      return pet.species || '—';
    case 'breed':
      return pet.breed || '—';
    case 'size':
      return SIZE_LABELS[pet.size] || pet.size || '—';
    case 'energyLevel':
      return ENERGY_LABELS[pet.energyLevel] || pet.energyLevel || '—';
    case 'careLevel':
      return CARE_LABELS[pet.careLevel] || pet.careLevel || '—';
    case 'activityNeeds':
      return ACTIVITY_LABELS[pet.activityNeeds] || pet.activityNeeds || '—';
    case 'temperamentTraits':
      return Array.isArray(pet.temperamentTraits) && pet.temperamentTraits.length
        ? pet.temperamentTraits.join(', ')
        : '—';
    case 'isKidFriendly':
      return pet.isKidFriendly ? 'Да' : 'Нет';
    case 'isPetFriendly':
      return pet.isPetFriendly ? 'Да' : 'Нет';
    case 'hypoallergenic':
      return pet.hypoallergenic ? 'Да' : 'Нет';
    case 'area':
      return pet.area || '—';
    case 'birthDate':
      return formatAge(pet.birthDate);
    default:
      return '—';
  }
};

const isCellMatch = (rowKey, pet, prefs) => {
  if (!prefs) return false;
  const v = (s) => (s || '').toLowerCase().trim();
  switch (rowKey) {
    case 'species':
      return Array.isArray(prefs.preferredSpecies) && prefs.preferredSpecies.some((s) => v(s) === v(pet.species));
    case 'breed':
      return Array.isArray(prefs.preferredBreeds) && prefs.preferredBreeds.some((b) => v(b) === v(pet.breed));
    case 'size':
      return Array.isArray(prefs.preferredSizes) && prefs.preferredSizes.includes(pet.size);
    case 'energyLevel': {
      const el = prefs.energyLevel;
      if (!el) return false;
      const levels = el.split(',').map((s) => v(s));
      return levels.includes(v(pet.energyLevel));
    }
    case 'careLevel': {
      const cl = prefs.careLevel;
      if (!cl) return false;
      const levels = cl.split(',').map((s) => v(s));
      return levels.includes(v(pet.careLevel));
    }
    case 'activityNeeds': {
      const a = prefs.activityNeeds || prefs.activityLevel;
      if (!a) return false;
      return normActivity(pet.activityNeeds) === normActivity(a);
    }
    case 'temperamentTraits':
      if (!Array.isArray(prefs.preferredTemperaments) || prefs.preferredTemperaments.length === 0) return false;
      const traits = pet.temperamentTraits || [];
      return traits.some((t) => prefs.preferredTemperaments.some((p) => v(p) === v(t)));
    case 'isKidFriendly':
      return prefs.hasKids && pet.isKidFriendly;
    case 'isPetFriendly':
      return prefs.hasOtherPets && pet.isPetFriendly;
    case 'hypoallergenic':
      return prefs.allergyFriendly && pet.hypoallergenic;
    case 'area':
      return Array.isArray(prefs.preferredCities) && prefs.preferredCities.some((c) => v(c) === v(pet.area));
    default:
      return false;
  }
};

const countMatches = (pet, prefs) => {
  if (!prefs) return 0;
  return ROW_KEYS_FOR_SCORING.filter((key) => isCellMatch(key, pet, prefs)).length;
};

const ComparePets = ({ isGuest, onGuestClick, scrollToPets }) => {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [aiRecommendation, setAiRecommendation] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [recommendedPetId, setRecommendedPetId] = useState(null);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [preferences, setPreferences] = useState(null);
  const [copyDone, setCopyDone] = useState(false);

  const prefsOk = useMemo(() => hasMeaningfulPreferences(preferences), [preferences]);

  const fetchFavorites = useCallback(async () => {
    if (!user?.token) return;
    try {
      setLoading(true);
      const res = await fetch('/api/favorites', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      const list = (data.favorites || []).map((f) => f.pet).filter(Boolean);
      setFavorites(list);
      setSelectedIds([]);
      setAiRecommendation(null);
      setAiError(null);
      setRecommendedPetId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user?.token]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  useEffect(() => {
    if (!user?.token) return;
    fetch('/api/user/preferences', {
      headers: { Authorization: `Bearer ${user.token}` }
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setPreferences(data || null))
      .catch(() => setPreferences(null));
  }, [user?.token]);

  useEffect(() => {
    if (!user?.token) return;
    const socket = io(getSocketServerUrl(), { path: '/socket.io', auth: { token: user.token } });
    socket.on('favoriteAdded', () => fetchFavorites());
    socket.on('favoriteRemoved', () => fetchFavorites());
    socket.on('petRequestUpdate', () => fetchFavorites());
    return () => socket.disconnect();
  }, [user?.token, fetchFavorites]);

  const toggleSelect = (petId) => {
    setSelectedIds((prev) => {
      if (prev.includes(petId)) return prev.filter((id) => id !== petId);
      if (prev.length >= 4) return prev;
      return [...prev, petId];
    });
    setAiRecommendation(null);
    setAiError(null);
    setRecommendedPetId(null);
  };

  const selectFirstTwo = () => {
    const ids = favorites.slice(0, 2).map((p) => p._id);
    setSelectedIds(ids);
    setAiRecommendation(null);
    setAiError(null);
    setRecommendedPetId(null);
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setAiRecommendation(null);
    setAiError(null);
    setRecommendedPetId(null);
  };

  const handleAiRecommendation = async () => {
    if (selectedIds.length < 2 || !user?.token) return;
    setAiLoading(true);
    setAiRecommendation(null);
    setAiError(null);
    setRecommendedPetId(null);
    try {
      const res = await fetch('/api/recommendations/compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ petIds: selectedIds })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiError(data.message || data.error || `Ошибка запроса (${res.status})`);
        return;
      }
      setAiRecommendation(data.recommendation || 'Не удалось получить рекомендацию.');
      setRecommendedPetId(data.recommendedPetId || null);
    } catch (err) {
      setAiError('Ошибка сети. Попробуйте позже.');
    } finally {
      setAiLoading(false);
    }
  };

  const copyRecommendation = async () => {
    if (!aiRecommendation) return;
    try {
      await navigator.clipboard.writeText(aiRecommendation);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    } catch {
      setCopyDone(false);
    }
  };

  const renderShelter = (pet) => {
    const s = pet.shelter_id;
    if (s && typeof s === 'object' && s.name && s._id) {
      return (
        <Link className="compare-shelter-link" to={`/pawfinds/shelters?shelter=${s._id}`}>
          {s.name}
        </Link>
      );
    }
    return '—';
  };

  if (isGuest) {
    return (
      <section className="compare-pets-block" id="compare-pets-section">
        <div className="compare-pets-header">
          <h2>
            Сравнение избранных
            <span className="ai-badge">
              <AIRobotIcon size={16} variant="onDark" decorative /> AI
            </span>
          </h2>
          <p className="compare-pets-subtitle">
            Войдите в аккаунт, чтобы добавлять питомцев в избранное и сравнивать их по характеристикам.
          </p>
        </div>
        <div className="compare-pets-cta">
          <button type="button" className="compare-pets-cta-btn" onClick={() => onGuestClick && onGuestClick()}>
            Войти для сравнения
          </button>
        </div>
      </section>
    );
  }

  const comparePets = favorites.filter((p) => selectedIds.includes(p._id));
  const needMore = Math.max(0, 2 - favorites.length);
  const scoringTotal = ROW_KEYS_FOR_SCORING.length;

  const renderDataCells = (pet, { mobile } = {}) => {
    return TABLE_ROWS.map((row) => {
      if (row === 'shelter') {
        return (
          <td key={row} className={mobile ? 'compare-card-value' : ''}>
            {renderShelter(pet)}
          </td>
        );
      }
      const match = prefsOk && isCellMatch(row, pet, preferences);
      const cls = match ? 'compare-cell-match' : '';
      const title = match ? 'Совпадает с вашими предпочтениями' : undefined;
      return (
        <td
          key={row}
          className={`${cls} ${mobile ? 'compare-card-value' : ''}`.trim()}
          title={title}
        >
          {match && <span className="compare-cell-check" aria-hidden="true">✓ </span>}
          <span>{getValue(pet, row)}</span>
        </td>
      );
    });
  };

  return (
    <section className="compare-pets-block" id="compare-pets-section">
      <div className="compare-pets-header">
        <h2>
          Сравнение избранных
          <span className="ai-badge">
            <AIRobotIcon size={16} variant="onDark" decorative /> AI
          </span>
        </h2>
        <p className="compare-pets-subtitle">
          Выберите 2–4 питомца из избранного, чтобы сравнить их и получить AI-рекомендацию.
        </p>
        <p className="compare-legend">
          <span className="compare-legend-swatch" aria-hidden="true" />
          Подсвеченные ячейки — совпадение с вашими предпочтениями (профиль).
        </p>
        {!prefsOk && (
          <p className="compare-prefs-hint">
            Заполните предпочтения в профиле, чтобы подсветка совпадений работала.
          </p>
        )}
      </div>

      {loading ? (
        <p className="compare-pets-loading">Загрузка избранного...</p>
      ) : favorites.length < 2 ? (
        <div className="compare-pets-cta">
          <p className="compare-pets-cta-text">
            Хотите сравнить избранных питомцев? Добавьте ещё {needMore === 2 ? '2' : '1'}{' '}
            {needMore === 2 ? 'питомцев' : 'питомца'} в избранное.
          </p>
          <button className="compare-pets-cta-btn" onClick={() => setShowCompareModal(true)}>
            Сравнить избранных
          </button>
        </div>
      ) : (
        <>
          <div className="compare-select-toolbar">
            <button type="button" className="compare-toolbar-btn" onClick={selectFirstTwo}>
              Выбрать первых двух
            </button>
            <button type="button" className="compare-toolbar-btn compare-toolbar-btn--ghost" onClick={clearSelection}>
              Снять выбор
            </button>
          </div>

          <div className="compare-pets-select">
            {favorites.map((pet) => (
              <label key={pet._id} className="compare-pet-checkbox">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(pet._id)}
                  onChange={() => toggleSelect(pet._id)}
                  disabled={!selectedIds.includes(pet._id) && selectedIds.length >= 4}
                />
                <span className="compare-pet-checkbox-label">
                  <img
                    src={getPetImageUrl(pet.filename)}
                    alt={pet.name}
                    onError={(e) => {
                      e.target.src = '/api/images/default.jpg';
                    }}
                  />
                  <span className="compare-pet-checkbox-text">
                    <span className="compare-pet-name-inline">{pet.name}</span>
                    {pet.status === 'Adopted' && <span className="compare-pet-adopted-badge">Усыновлён</span>}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {selectedIds.length < 2 && (
            <p className="compare-select-hint" role="status">
              Отметьте минимум двух питомцев выше.
            </p>
          )}

          {comparePets.length >= 2 && (
            <>
              <div className="compare-pets-actions">
                <button className="compare-ai-btn" onClick={handleAiRecommendation} disabled={aiLoading}>
                  {aiLoading ? (
                    'Загрузка...'
                  ) : (
                    <>
                      <AIRobotIcon size={18} variant="onDark" decorative />
                      Получить AI-рекомендацию
                    </>
                  )}
                </button>
                {aiRecommendation && !aiError && (
                  <>
                    <button type="button" className="compare-ai-secondary-btn" onClick={handleAiRecommendation}>
                      Повторить запрос
                    </button>
                    <button type="button" className="compare-ai-secondary-btn" onClick={copyRecommendation}>
                      {copyDone ? 'Скопировано' : 'Скопировать текст'}
                    </button>
                  </>
                )}
              </div>

              {aiError && (
                <div className="compare-ai-error" role="alert">
                  {aiError}
                  <button type="button" className="compare-ai-retry-link" onClick={handleAiRecommendation}>
                    Повторить
                  </button>
                </div>
              )}

              {aiRecommendation && !aiError && (
                <div className="compare-ai-result">
                  <strong>AI-рекомендация:</strong>
                  <p>{aiRecommendation}</p>
                </div>
              )}

              {/* Десктоп / планшет: таблица */}
              <div className="compare-pets-table-view">
                <div className="compare-pets-table-wrap">
                  <table className="compare-pets-table">
                    <caption className="visually-hidden">
                      Сравнение выбранных питомцев по параметрам; первая колонка — названия полей.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Параметр</th>
                        {comparePets.map((pet) => {
                          const matches = countMatches(pet, preferences);
                          const rec = recommendedPetId && String(pet._id) === String(recommendedPetId);
                          return (
                            <th key={pet._id} scope="col">
                              <div
                                className={`compare-pet-thumb ${rec ? 'compare-pet-thumb--recommended' : ''}`}
                                onClick={() => navigate(`/pawfinds/adopt-form/${pet._id}`)}
                                title={
                                  pet.status === 'Adopted'
                                    ? 'Просмотр карточки (уже усыновлён)'
                                    : 'Открыть анкету'
                                }
                              >
                                <img
                                  src={getPetImageUrl(pet.filename)}
                                  alt=""
                                  onError={(e) => {
                                    e.target.src = '/api/images/default.jpg';
                                  }}
                                />
                                <span>{pet.name}</span>
                                {rec && <span className="compare-rec-badge">Рекомендация AI</span>}
                                {pet.status === 'Adopted' && (
                                  <span className="compare-pet-adopted-badge compare-pet-adopted-badge--thumb">
                                    Усыновлён
                                  </span>
                                )}
                                {prefsOk && (
                                  <span className="compare-match-count">
                                    {matches}/{scoringTotal} совпад.
                                  </span>
                                )}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {TABLE_ROWS.map((row) => (
                        <tr key={row}>
                          <th scope="row" className="compare-param-name">
                            {LABELS[row]}
                          </th>
                          {comparePets.map((pet) => {
                            if (row === 'shelter') {
                              return (
                                <td key={pet._id}>{renderShelter(pet)}</td>
                              );
                            }
                            const match = prefsOk && isCellMatch(row, pet, preferences);
                            return (
                              <td
                                key={pet._id}
                                className={match ? 'compare-cell-match' : ''}
                                title={match ? 'Совпадает с вашими предпочтениями' : undefined}
                              >
                                {match && (
                                  <span className="compare-cell-check" aria-hidden="true">
                                    ✓{' '}
                                  </span>
                                )}
                                {getValue(pet, row)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Мобильные карточки */}
              <div className="compare-pets-cards-view" aria-label="Сравнение питомцев (карточки)">
                {comparePets.map((pet) => {
                  const matches = countMatches(pet, preferences);
                  const rec = recommendedPetId && String(pet._id) === String(recommendedPetId);
                  return (
                    <article key={pet._id} className={`compare-pet-card ${rec ? 'compare-pet-card--recommended' : ''}`}>
                      <header className="compare-pet-card-head">
                        <img
                          className="compare-pet-card-img"
                          src={getPetImageUrl(pet.filename)}
                          alt=""
                          onError={(e) => {
                            e.target.src = '/api/images/default.jpg';
                          }}
                        />
                        <div>
                          <button
                            type="button"
                            className="compare-pet-card-name"
                            onClick={() => navigate(`/pawfinds/adopt-form/${pet._id}`)}
                          >
                            {pet.name}
                          </button>
                          {rec && <div className="compare-rec-badge compare-rec-badge--inline">Рекомендация AI</div>}
                          {prefsOk && (
                            <div className="compare-match-count compare-match-count--card">
                              {matches}/{scoringTotal} совпадений с предпочтениями
                            </div>
                          )}
                        </div>
                      </header>
                      <dl className="compare-pet-card-dl">
                        {TABLE_ROWS.map((row) => (
                          <div key={row} className="compare-pet-card-row">
                            <dt>{LABELS[row]}</dt>
                            <dd
                              className={
                                prefsOk && row !== 'shelter' && isCellMatch(row, pet, preferences)
                                  ? 'compare-cell-match compare-card-dd'
                                  : 'compare-card-dd'
                              }
                            >
                              {row === 'shelter' ? renderShelter(pet) : getValue(pet, row)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {showCompareModal && (
        <div className="compare-modal-overlay" onClick={() => setShowCompareModal(false)}>
          <div className="compare-modal" onClick={(e) => e.stopPropagation()}>
            <button className="compare-modal-close" onClick={() => setShowCompareModal(false)}>
              ×
            </button>
            <div className="compare-modal-icon">🐾</div>
            <h3>Хотите сравнить?</h3>
            <p>
              Добавьте ещё {needMore === 2 ? '2' : '1'} {needMore === 2 ? 'питомцев' : 'питомца'} в избранное,
              чтобы сравнить их и получить AI-рекомендацию.
            </p>
            <button
              className="compare-modal-goto-btn"
              onClick={() => {
                setShowCompareModal(false);
                scrollToPets?.();
              }}
            >
              Перейти к каталогу
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default ComparePets;
