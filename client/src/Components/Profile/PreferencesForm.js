import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuthContext } from '../../hooks/UseAuthContext';
import './PreferencesForm.css';

const sizeOptions = [
    { value: 'small', label: 'Маленький' },
    { value: 'medium', label: 'Средний' },
    { value: 'large', label: 'Крупный' },
    { value: 'giant', label: 'Очень крупный' }
];

const activityOptions = [
    { value: '', label: 'Неважно' },
    { value: 'low', label: 'Низкая активность' },
    { value: 'medium', label: 'Средняя активность' },
    { value: 'high', label: 'Высокая активность' }
];

const careOptions = [
    { value: '', label: 'Неважно' },
    { value: 'low', label: 'Низкий уход' },
    { value: 'medium', label: 'Средний уход' },
    { value: 'high', label: 'Высокий уход' }
];

const splitToArray = (value) => {
    if (!value) return [];
    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((item, index, array) => array.indexOf(item) === index);
};

const PreferencesForm = () => {
    const { user, dispatch } = useAuthContext();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [speciesOptions, setSpeciesOptions] = useState([]);
    const [formValues, setFormValues] = useState({
        preferredSpecies: [],
        preferredBreeds: '',
        preferredSizes: [],
        activityLevel: '',
        careLevel: '',
        hasKids: false,
        hasOtherPets: false,
        allergyFriendly: false,
        preferredTemperaments: '',
        preferredCities: '',
        livingSpace: ''
    });

    useEffect(() => {
        let isCancelled = false;

        const loadSpecies = async () => {
            try {
                const response = await fetch('/api/pets/species');
                if (!response.ok) return;
                const data = await response.json();
                if (!isCancelled) {
                    setSpeciesOptions(Array.isArray(data) ? data : []);
                }
            } catch (err) {
                console.error('Failed to load species list:', err);
            }
        };

        const loadPreferences = async (allowRefresh = true) => {
            if (!user || !user.token) {
                setLoading(false);
                return;
            }

            try {
                const response = await fetch('/api/user/preferences', {
                    headers: {
                        'Authorization': `Bearer ${user.token}`
                    }
                });

                if (response.status === 401 && allowRefresh) {
                    try {
                        console.log('Token expired while fetching preferences, attempting refresh...');
                        const refreshResponse = await axios.post('/api/user/refresh-token', {}, {
                            withCredentials: true
                        });

                        if (refreshResponse.data && refreshResponse.data.token) {
                            const { token, userName, email, role, _id } = refreshResponse.data;

                            const updatedUser = {
                                userName,
                                email,
                                token,
                                _id: _id || user?._id,
                                role: role || (user ? user.role : 'user')
                            };

                            sessionStorage.setItem('user', JSON.stringify(updatedUser));
                            sessionStorage.setItem('token', token);
                            dispatch({ type: 'LOGIN', payload: updatedUser });

                            return loadPreferences(false);
                        }
                    } catch (refreshError) {
                        console.error('Failed to refresh token while fetching preferences:', refreshError);
                    }
                }

                if (!response.ok) {
                    throw new Error('Не удалось загрузить предпочтения');
                }

                const data = await response.json();

                if (!isCancelled && data) {
                    setFormValues({
                        preferredSpecies: Array.isArray(data.preferredSpecies) ? data.preferredSpecies : [],
                        preferredBreeds: Array.isArray(data.preferredBreeds) ? data.preferredBreeds.join(', ') : '',
                        preferredSizes: Array.isArray(data.preferredSizes) ? data.preferredSizes : [],
                        activityLevel: data.activityLevel || '',
                        careLevel: data.careLevel || '',
                        hasKids: Boolean(data.hasKids),
                        hasOtherPets: Boolean(data.hasOtherPets),
                        allergyFriendly: Boolean(data.allergyFriendly),
                        preferredTemperaments: Array.isArray(data.preferredTemperaments) ? data.preferredTemperaments.join(', ') : '',
                        preferredCities: Array.isArray(data.preferredCities) ? data.preferredCities.join(', ') : '',
                        livingSpace: data.livingSpace || ''
                    });
                }
            } catch (err) {
                if (!isCancelled) {
                    console.error('Error loading preferences:', err);
                    setError('Не удалось загрузить предпочтения. Попробуйте позже.');
                }
            } finally {
                if (!isCancelled) {
                    setLoading(false);
                }
            }
        };

        loadSpecies();
        loadPreferences();

        return () => {
            isCancelled = true;
        };
    }, [user, dispatch]);

    const handleSpeciesToggle = (species) => {
        setFormValues((prev) => {
            const exists = prev.preferredSpecies.includes(species);
            return {
                ...prev,
                preferredSpecies: exists
                    ? prev.preferredSpecies.filter((item) => item !== species)
                    : [...prev.preferredSpecies, species]
            };
        });
    };

    const handleSizeToggle = (value) => {
        setFormValues((prev) => {
            const exists = prev.preferredSizes.includes(value);
            return {
                ...prev,
                preferredSizes: exists
                    ? prev.preferredSizes.filter((item) => item !== value)
                    : [...prev.preferredSizes, value]
            };
        });
    };

    const handleBooleanChange = (field) => (event) => {
        const { checked } = event.target;
        setFormValues((prev) => ({
            ...prev,
            [field]: checked
        }));
    };

    const handleInputChange = (field) => (event) => {
        const { value } = event.target;
        setFormValues((prev) => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSelectChange = (field) => (event) => {
        const { value } = event.target;
        setFormValues((prev) => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError(null);
        setSuccess(null);

        if (!user || !user.token) {
            setError('Необходимо войти в аккаунт');
            return;
        }

        const payload = {
            preferredSpecies: formValues.preferredSpecies,
            preferredBreeds: splitToArray(formValues.preferredBreeds),
            preferredSizes: formValues.preferredSizes,
            activityLevel: formValues.activityLevel,
            careLevel: formValues.careLevel,
            hasKids: formValues.hasKids,
            hasOtherPets: formValues.hasOtherPets,
            allergyFriendly: formValues.allergyFriendly,
            preferredTemperaments: splitToArray(formValues.preferredTemperaments),
            preferredCities: splitToArray(formValues.preferredCities),
            livingSpace: formValues.livingSpace.trim()
        };

        setSaving(true);
        try {
            const response = await fetch('/api/user/preferences', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify(payload)
            });

            if (response.status === 401) {
                try {
                    console.log('Token expired while saving preferences, attempting refresh...');
                    const refreshResponse = await axios.post('/api/user/refresh-token', {}, {
                        withCredentials: true
                    });

                    if (refreshResponse.data && refreshResponse.data.token) {
                        const { token, userName, email, role, _id } = refreshResponse.data;

                        const updatedUser = {
                            userName,
                            email,
                            token,
                            _id: _id || user?._id,
                            role: role || (user ? user.role : 'user')
                        };

                        sessionStorage.setItem('user', JSON.stringify(updatedUser));
                        sessionStorage.setItem('token', token);
                        dispatch({ type: 'LOGIN', payload: updatedUser });

                        const retryResponse = await fetch('/api/user/preferences', {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify(payload)
                        });

                        if (!retryResponse.ok) {
                            throw new Error('Не удалось сохранить предпочтения');
                        }

                        setSuccess('Предпочтения успешно обновлены');
                        return;
                    }
                } catch (refreshError) {
                    console.error('Failed to refresh token while saving preferences:', refreshError);
                    throw new Error('Не удалось обновить токен. Выполните вход повторно.');
                }
            }

            if (!response.ok) {
                throw new Error('Не удалось сохранить предпочтения');
            }

            setSuccess('Предпочтения успешно обновлены');
        } catch (err) {
            console.error('Error saving preferences:', err);
            setError(err.message || 'Произошла ошибка при сохранении предпочтений');
        } finally {
            setSaving(false);
        }
    };

    if (!user) {
        return (
            <div className="preferences-card">
                <h2>Персональные предпочтения</h2>
                <p>Войдите в систему, чтобы настроить персонализированные рекомендации.</p>
            </div>
        );
    }

    return (
        <div className="preferences-card">
            <h2>Персональные предпочтения</h2>
            <p className="preferences-subtitle">
                Укажите ваши предпочтения и образ жизни, чтобы мы могли подобрать животных, которые подойдут именно вам.
            </p>

            {loading ? (
                <p>Загрузка предпочтений...</p>
            ) : (
                <form onSubmit={handleSubmit} className="preferences-form">
                    <section className="preferences-section">
                        <h3>Основные предпочтения</h3>
                        <div className="checkbox-group">
                            <span className="group-label">Предпочитаемые виды:</span>
                            <div className="checkbox-grid">
                                {speciesOptions.map((species) => (
                                    <label key={species} className="checkbox-item">
                                        <input
                                            type="checkbox"
                                            checked={formValues.preferredSpecies.includes(species)}
                                            onChange={() => handleSpeciesToggle(species)}
                                        />
                                        <span>{species}</span>
                                    </label>
                                ))}
                                {speciesOptions.length === 0 && (
                                    <p className="helper-text">Список видов пока пуст, но вы всё равно можете указать свои предпочтения позже.</p>
                                )}
                            </div>
                        </div>

                        <label className="form-field">
                            <span>Предпочитаемые породы (через запятую)</span>
                            <input
                                type="text"
                                value={formValues.preferredBreeds}
                                onChange={handleInputChange('preferredBreeds')}
                                placeholder="Например: Лабрадор, Сибирская"
                            />
                        </label>

                        <div className="checkbox-group">
                            <span className="group-label">Размер питомца:</span>
                            <div className="checkbox-row">
                                {sizeOptions.map((option) => (
                                    <label key={option.value} className="checkbox-item">
                                        <input
                                            type="checkbox"
                                            checked={formValues.preferredSizes.includes(option.value)}
                                            onChange={() => handleSizeToggle(option.value)}
                                        />
                                        <span>{option.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <label className="form-field">
                            <span>Особенности характера (через запятую)</span>
                            <input
                                type="text"
                                value={formValues.preferredTemperaments}
                                onChange={handleInputChange('preferredTemperaments')}
                                placeholder="Например: спокойный, игривый"
                            />
                        </label>
                    </section>

                    <section className="preferences-section">
                        <h3>Образ жизни</h3>
                        <div className="form-row">
                            <label className="form-field">
                                <span>Уровень активности</span>
                                <select
                                    value={formValues.activityLevel}
                                    onChange={handleSelectChange('activityLevel')}
                                >
                                    {activityOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="form-field">
                                <span>Требуемый уровень ухода</span>
                                <select
                                    value={formValues.careLevel}
                                    onChange={handleSelectChange('careLevel')}
                                >
                                    {careOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <label className="form-field">
                            <span>Жилищные условия</span>
                            <input
                                type="text"
                                value={formValues.livingSpace}
                                onChange={handleInputChange('livingSpace')}
                                placeholder="Например: просторная квартира, дом с двором"
                            />
                        </label>

                        <label className="form-field">
                            <span>Предпочитаемые города (через запятую)</span>
                            <input
                                type="text"
                                value={formValues.preferredCities}
                                onChange={handleInputChange('preferredCities')}
                                placeholder="Например: Минск, Гомель"
                            />
                        </label>
                    </section>

                    <section className="preferences-section">
                        <h3>Условия в семье</h3>
                        <div className="toggle-group">
                            <label className="toggle-item">
                                <input
                                    type="checkbox"
                                    checked={formValues.hasKids}
                                    onChange={handleBooleanChange('hasKids')}
                                />
                                <span>В семье есть дети</span>
                            </label>
                            <label className="toggle-item">
                                <input
                                    type="checkbox"
                                    checked={formValues.hasOtherPets}
                                    onChange={handleBooleanChange('hasOtherPets')}
                                />
                                <span>У нас уже есть другие питомцы</span>
                            </label>
                            <label className="toggle-item">
                                <input
                                    type="checkbox"
                                    checked={formValues.allergyFriendly}
                                    onChange={handleBooleanChange('allergyFriendly')}
                                />
                                <span>Важно, чтобы питомец был гипоаллергенным</span>
                            </label>
                        </div>
                    </section>

                    {error && <div className="preferences-error">{error}</div>}
                    {success && <div className="preferences-success">{success}</div>}

                    <div className="form-actions">
                        <button type="submit" className="save-preferences-btn" disabled={saving}>
                            {saving ? 'Сохраняем...' : 'Сохранить предпочтения'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};

export default PreferencesForm;

