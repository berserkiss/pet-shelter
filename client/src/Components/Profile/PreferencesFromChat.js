import React, { useEffect, useState } from 'react';
import { useAuthContext } from '../../hooks/UseAuthContext';
import './PreferencesForm.css';

const Field = ({ label, children }) => (
  <div className="pref-readonly-row">
    <span className="pref-readonly-label">{label}</span>
    <div className="pref-readonly-value">{children}</div>
  </div>
);

const pill = (text, key) => (
  <span key={key} className="pref-pill">{text}</span>
);

// Функции перевода значений на русский
const translateSpecies = (species) => {
  const map = {
    'dog': 'Собака',
    'cat': 'Кошка',
    'bird': 'Птица',
    'rabbit': 'Кролик'
  };
  return map[species?.toLowerCase()] || species;
};

const translateSize = (size) => {
  const map = {
    'small': 'Маленький',
    'medium': 'Средний',
    'large': 'Большой'
  };
  return map[size?.toLowerCase()] || size;
};

const translateTemperament = (temp) => {
  const map = {
    'calm': 'Спокойный',
    'playful': 'Игривый',
    'friendly': 'Дружелюбный',
    'independent': 'Независимый',
    'energetic': 'Энергичный',
    'gentle': 'Нежный',
    'protective': 'Защитный',
    'curious': 'Любопытный',
    'affectionate': 'Ласковый',
    'loyal': 'Верный'
  };
  return map[temp?.toLowerCase()] || temp;
};

const translateAge = (age) => {
  const map = {
    'young': 'Молодой',
    'adult': 'Взрослый',
    'senior': 'Пожилой'
  };
  return map[age?.toLowerCase()] || age;
};

const translateEnergyLevel = (level) => {
  const map = {
    'low': 'Низкий',
    'medium': 'Средний',
    'high': 'Высокий'
  };
  return map[level?.toLowerCase()] || level;
};

const translateActivityLevel = (level) => {
  const map = {
    'low': 'Низкая',
    'medium': 'Средняя',
    'high': 'Высокая'
  };
  return map[level?.toLowerCase()] || level;
};

const translateCareLevel = (level) => {
  const map = {
    'low': 'Простой',
    'medium': 'Средний',
    'high': 'Сложный'
  };
  return map[level?.toLowerCase()] || level;
};

const translateLivingSpace = (space) => {
  const map = {
    'apartment': 'Квартира',
    'house': 'Дом',
    'house with yard': 'Дом с двором',
    'farm': 'Ферма'
  };
  return map[space?.toLowerCase()] || space;
};

const PreferencesFromChat = () => {
  const { user } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [prefs, setPrefs] = useState(null);
  const [clearing, setClearing] = useState(false);

  const load = async () => {
    if (!user?.token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/user/preferences', {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      if (!res.ok) throw new Error('Failed to load preferences');
      const data = await res.json();
      setPrefs(data || {});
    } catch (e) {
      setError('Не удалось загрузить предпочтения');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const onUpdated = () => load();
    // Fallback: обновление через кастомное событие из чата
    window.addEventListener('ai:prefs-updated', onUpdated);
    // Основной путь: обновление через сокеты (реагируем на подключение/переподключение)
    let socket = window.globalSocket || null;
    let connectedListener = null;
    let cleanupSocketListeners = () => {};
    const attachSocketListeners = (sock) => {
      if (!sock) return;
      const handler = onUpdated;
      sock.on('userPreferencesUpdated', handler);
      sock.on('ai:preferencesUpdated', handler);
      cleanupSocketListeners = () => {
        sock.off('userPreferencesUpdated', handler);
        sock.off('ai:preferencesUpdated', handler);
      };
    };
    if (socket && socket.connected) {
      attachSocketListeners(socket);
    }
    // Если сокет ещё не подключён — навешиваем на 'connect' и прикрепляем обработчики после подключения
    if (socket) {
      connectedListener = () => attachSocketListeners(socket);
      socket.on('connect', connectedListener);
    }
    return () => {
      window.removeEventListener('ai:prefs-updated', onUpdated);
      cleanupSocketListeners();
      if (socket && connectedListener) socket.off('connect', connectedListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.token]);

  if (!user) {
    return (
      <div className="preferences-card">
        <h2>Предпочтения из диалога</h2>
        <p>Войдите, чтобы увидеть персональные предпочтения.</p>
      </div>
    );
  }

  const handleClear = async () => {
    if (!user?.token || clearing) return;
    setClearing(true);
    setError(null);
    try {
      const res = await fetch('/api/user/preferences', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` }
      });
      if (!res.ok) throw new Error('Не удалось очистить предпочтения');
      await load();
    } catch (e) {
      setError('Не удалось очистить предпочтения');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="preferences-card">
      <h2>Предпочтения из диалога</h2>
      <p className="preferences-subtitle">
        Эти данные собраны автоматически из беседы с AI и обновляются после каждого сообщения.
      </p>

      {loading ? (
        <p>Загрузка…</p>
      ) : error ? (
        <div className="preferences-error">{error}</div>
      ) : (
        <div className="preferences-readonly">
          <Field label="Виды животных">
            {(prefs?.preferredSpecies || []).length > 0
              ? prefs.preferredSpecies.map((s, i) => pill(translateSpecies(s), i))
              : <span className="pref-empty">не указано</span>}
          </Field>
          <Field label="Породы">
            {(prefs?.preferredBreeds || []).length > 0
              ? prefs.preferredBreeds.map((s, i) => pill(s, i))
              : <span className="pref-empty">не указано</span>}
          </Field>
          <Field label="Размер">
            {(prefs?.preferredSizes || []).length > 0
              ? prefs.preferredSizes.map((s, i) => pill(translateSize(s), i))
              : <span className="pref-empty">не указано</span>}
          </Field>
          <Field label="Города">
            {(prefs?.preferredCities || []).length > 0
              ? prefs.preferredCities.map((s, i) => pill(s, i))
              : <span className="pref-empty">не указано</span>}
          </Field>
          <Field label="Темперамент">
            {(prefs?.preferredTemperaments || []).length > 0
              ? prefs.preferredTemperaments.map((s, i) => pill(translateTemperament(s), i))
              : <span className="pref-empty">не указано</span>}
          </Field>
          <Field label="Возраст">
            {prefs?.preferredAgeRange ? translateAge(prefs.preferredAgeRange) : <span className="pref-empty">не указано</span>}
          </Field>
          <Field label="Уровень энергии">
            {prefs?.energyLevel ? translateEnergyLevel(prefs.energyLevel) : <span className="pref-empty">не указано</span>}
          </Field>
          <Field label="Уровень активности">
            {prefs?.activityNeeds ? translateActivityLevel(prefs.activityNeeds) : <span className="pref-empty">не указано</span>}
          </Field>
          <Field label="Сложность ухода">
            {prefs?.careLevel ? translateCareLevel(prefs.careLevel) : <span className="pref-empty">не указано</span>}
          </Field>
          <Field label="Тип жилья">
            {prefs?.livingSpace ? translateLivingSpace(prefs.livingSpace) : <span className="pref-empty">не указано</span>}
          </Field>
          <Field label="Дети">
            {pill(prefs?.hasKids ? '✓ Есть дети' : '✗ Нет детей')}
          </Field>
          <Field label="Другие животные">
            {pill(prefs?.hasOtherPets ? '✓ Есть другие питомцы' : '✗ Нет других питомцев')}
          </Field>
          <Field label="Аллергии">
            {pill(prefs?.allergyFriendly ? '✓ Нужен гипоаллергенный' : '✗ Аллергий нет')}
          </Field>
          <div className="form-actions">
            <button type="button" className="save-preferences-btn" onClick={handleClear} disabled={clearing}>
              {clearing ? 'Очищаем…' : 'Очистить предпочтения'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreferencesFromChat;


