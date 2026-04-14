import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../../hooks/UseAuthContext';
import { useAuthModal } from '../../Context/AuthModalContext';
import axios from 'axios';
import './VolunteerForm.css';

const VolunteerForm = ({ shelter, onClose }) => {
    const { user, dispatch } = useAuthContext();
    const { showAuthModal } = useAuthModal();
    
    // Состояния формы
    const [name, setName] = useState(user ? user.name : '');
    const [email] = useState(user ? user.email : '');
    const [phone, setPhone] = useState('');
    const [age, setAge] = useState('');
    const [experience, setExperience] = useState('');
    const [availability, setAvailability] = useState('');
    const [message, setMessage] = useState('');
    const [skills, setSkills] = useState([]);
    const [interests, setInterests] = useState([]);
    
    // Состояния UI
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // Локальная копия данных приюта для обновления при изменениях
    const [shelterData, setShelterData] = useState(shelter);
    
    // Обновляем локальные данные приюта при изменении prop
    useEffect(() => {
        if (shelter) {
            setShelterData(shelter);
        }
    }, [shelter]);
    
    // Добавляем состояние для ошибок валидации
    const [validationErrors, setValidationErrors] = useState({
        name: '',
        phone: '',
        age: '',
        availability: '',
        message: ''
    });
    
    // Функции валидации
    const validateName = (value) => {
        if (!value.trim()) return 'Введите ваше имя';
        if (value.length < 2) return 'Имя должно содержать минимум 2 символа';
        if (value.length > 50) return 'Имя не должно превышать 50 символов';
        return '';
    };
    
    const validatePhone = (value) => {
        if (!value.trim()) return 'Введите номер телефона';
        const phonePattern = /^\+375[0-9]{9}$/;
        if (!phonePattern.test(value)) return 'Введите корректный номер телефона в формате +375XXXXXXXXX';
        return '';
    };
    
    const validateAge = (value) => {
        if (!value) return 'Укажите ваш возраст';
        const ageValue = parseInt(value);
        if (isNaN(ageValue) || ageValue < 18) return 'Волонтером может стать человек от 18 лет';
        if (ageValue > 100) return 'Пожалуйста, укажите корректный возраст';
        return '';
    };
    
    const validateAvailability = (value) => {
        if (!value) return 'Выберите вариант доступности';
        return '';
    };
    
    const validateMessage = (value) => {
        if (!value.trim()) return 'Расскажите, почему вы хотите стать волонтером';
        if (value.length < 10) return 'Сообщение должно содержать минимум 10 символов';
        if (value.length > 500) return 'Сообщение не должно превышать 500 символов';
        return '';
    };
    
    // Обновляем обработчики изменений полей с валидацией
    const handleNameChange = (e) => {
        const value = e.target.value;
        setName(value);
        setValidationErrors(prev => ({
            ...prev,
            name: validateName(value)
        }));
    };
    
    const handlePhoneChange = (e) => {
        const value = e.target.value;
        setPhone(value);
        setValidationErrors(prev => ({
            ...prev,
            phone: validatePhone(value)
        }));
    };
    
    const handleAgeChange = (e) => {
        const value = e.target.value;
        setAge(value);
        setValidationErrors(prev => ({
            ...prev,
            age: validateAge(value)
        }));
    };
    
    const handleAvailabilityChange = (e) => {
        const value = e.target.value;
        setAvailability(value);
        setValidationErrors(prev => ({
            ...prev,
            availability: validateAvailability(value)
        }));
    };
    
    const handleMessageChange = (e) => {
        const value = e.target.value;
        setMessage(value);
        setValidationErrors(prev => ({
            ...prev,
            message: validateMessage(value)
        }));
    };
    
    // Списки навыков и интересов
    const skillsList = [
        'Уход за животными',
        'Выгул животных',
        'Фотографирование',
        'Транспортировка',
        'Медицинский опыт',
        'Обучение животных',
        'Адаптация животных',
        'PR и маркетинг',
        'Опыт работы с документами',
        'ИТ и соцсети'
    ];
    
    const interestsList = [
        'Уход за кошками',
        'Уход за собаками',
        'Уход за грызунами',
        'Выгул собак',
        'Фотосессии животных',
        'Адаптация новых животных',
        'Работа с потенциальными усыновителями',
        'Обучение животных',
        'Транспортировка животных',
        'PR и продвижение приюта',
        'Административная работа'
    ];
    
    // Обработчики для множественного выбора
    const handleSkillsChange = (e) => {
        const value = e.target.value;
        setSkills(prevSkills => 
            prevSkills.includes(value)
                ? prevSkills.filter(skill => skill !== value)
                : [...prevSkills, value]
        );
    };
    
    const handleInterestsChange = (e) => {
        const value = e.target.value;
        setInterests(prevInterests => 
            prevInterests.includes(value)
                ? prevInterests.filter(interest => interest !== value)
                : [...prevInterests, value]
        );
    };
    
    // Отправка формы
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!user) {
            showAuthModal('подать заявку на волонтерство');
            return;
        }

        // Валидация всех полей
        const errors = {
            name: validateName(name),
            phone: validatePhone(phone),
            age: validateAge(age),
            availability: validateAvailability(availability),
            message: validateMessage(message)
        };

        setValidationErrors(errors);

        // Проверяем, есть ли ошибки
        const hasErrors = Object.values(errors).some(error => error !== '');
        if (hasErrors) {
            setError('Пожалуйста, исправьте ошибки в форме');
            return;
        }
        
        setLoading(true);
        setError(null);
        
        try {
            const formData = {
                    name,
                    email,
                    phone,
                    age: parseInt(age),
                    shelter_id: shelterData._id,
                    experience,
                    availability,
                    skills,
                    interests,
                    message
            };
            
            // Add user_id if available
            if (user && user._id) {
                formData.user_id = user._id;
            }
            
            const response = await fetch('/api/volunteers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify(formData)
            });
            
            // Handle token expiration
            if (response.status === 401) {
                try {
                    console.log('Token expired during submission, attempting to refresh...');
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
                        
                        // Try submitting again with new token
                        const retryResponse = await fetch('/api/volunteers', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${updatedUser.token}`
                            },
                            body: JSON.stringify(formData)
                        });
                        
                        const retryData = await retryResponse.json();
                        
                        if (!retryResponse.ok) {
                            throw new Error(retryData.error || 'Не удалось отправить заявку');
                        }
                        
                        // Заявка успешно отправлена, передаем успех в родительский компонент
                        onClose(true);
                        return;
                    }
                } catch (refreshError) {
                    console.error('Failed to refresh token:', refreshError);
                    throw new Error('Ошибка авторизации. Пожалуйста, войдите в систему снова.');
                }
            }
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Не удалось отправить заявку');
            }
            
            // Заявка успешно отправлена, передаем успех в родительский компонент
            onClose(true);
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="volunteer-form-container">
            <div className="volunteer-form-header">
                <h2>Стать волонтером в приюте "{shelterData.name}"</h2>
                <button className="volunteer-form-close" onClick={() => onClose(false)}>×</button>
            </div>
            
            <form className="volunteer-form" onSubmit={handleSubmit}>
                <div className="volunteer-form-section">
                    <h3>Контактная информация</h3>
                    <div className="volunteer-form-row">
                        <div className="volunteer-form-group">
                            <label>Ваше имя <span className="required">*</span></label>
                            <input
                                type="text"
                                value={name}
                                onChange={handleNameChange}
                                placeholder="Введите ваше имя"
                                className={`${validationErrors.name ? 'input-error' : ''}`}
                                required
                            />
                            {validationErrors.name && (
                                <div className="error-message">{validationErrors.name}</div>
                            )}
                        </div>
                        
                        <div className="volunteer-form-group">
                            <label>Email <span className="required">*</span></label>
                            <input
                                type="email"
                                value={email}
                                readOnly
                                className="readonly-field"
                                title="Email из вашего профиля"
                                required
                            />
                            <small>Используется email из вашего профиля</small>
                        </div>
                    </div>
                    
                    <div className="volunteer-form-row">
                        <div className="volunteer-form-group">
                            <label>Номер телефона</label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={handlePhoneChange}
                                placeholder="+375 (XX) XXX-XX-XX"
                                className={`volunteer-form-input ${validationErrors.phone ? 'input-error' : ''}`}
                            />
                            {validationErrors.phone && (
                                <div className="error-message">{validationErrors.phone}</div>
                            )}
                        </div>
                        
                        <div className="volunteer-form-group">
                            <label>Возраст <span className="required">*</span></label>
                            <input
                                type="number"
                                min="18"
                                max="100"
                                value={age}
                                onChange={handleAgeChange}
                                placeholder="Укажите ваш возраст"
                                className={`${validationErrors.age ? 'input-error' : ''}`}
                                required
                            />
                            {validationErrors.age && (
                                <div className="error-message">{validationErrors.age}</div>
                            )}
                            <small>Волонтером может стать человек от 18 лет</small>
                        </div>
                    </div>
                </div>
                
                <div className="volunteer-form-section">
                    <h3>Ваши предпочтения</h3>
                    <div className="volunteer-form-group">
                        <label>Опыт работы с животными</label>
                        <textarea
                            value={experience}
                            onChange={(e) => setExperience(e.target.value)}
                            placeholder="Опишите ваш опыт работы с животными (если есть)"
                            rows="3"
                        ></textarea>
                    </div>
                    
                    <div className="volunteer-form-group">
                        <label>Доступность <span className="required">*</span></label>
                        <select
                            value={availability}
                            onChange={handleAvailabilityChange}
                            className={`${validationErrors.availability ? 'input-error' : ''}`}
                            required
                        >
                            <option value="">Выберите вариант</option>
                            <option value="Будние дни">Будние дни</option>
                            <option value="Выходные дни">Выходные дни</option>
                            <option value="Утренние часы">Утренние часы</option>
                            <option value="Вечерние часы">Вечерние часы</option>
                            <option value="Гибкий график">Гибкий график</option>
                        </select>
                        {validationErrors.availability && (
                            <div className="error-message">{validationErrors.availability}</div>
                        )}
                    </div>
                </div>
                
                <div className="volunteer-form-section">
                    <h3>Навыки и интересы</h3>
                    <div className="volunteer-form-group">
                        <label>Ваши навыки</label>
                        <div className="volunteer-form-checkboxes">
                            {skillsList.map(skill => (
                                <div className="checkbox-item" key={skill}>
                                    <input
                                        type="checkbox"
                                        id={`skill-${skill}`}
                                        value={skill}
                                        checked={skills.includes(skill)}
                                        onChange={handleSkillsChange}
                                    />
                                    <label htmlFor={`skill-${skill}`}>{skill}</label>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="volunteer-form-group">
                        <label>Ваши интересы</label>
                        <div className="volunteer-form-checkboxes">
                            {interestsList.map(interest => (
                                <div className="checkbox-item" key={interest}>
                                    <input
                                        type="checkbox"
                                        id={`interest-${interest}`}
                                        value={interest}
                                        checked={interests.includes(interest)}
                                        onChange={handleInterestsChange}
                                    />
                                    <label htmlFor={`interest-${interest}`}>{interest}</label>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                
                <div className="volunteer-form-section">
                    <h3>Дополнительная информация</h3>
                    <div className="volunteer-form-group">
                        <label>Почему вы хотите стать волонтером? <span className="required">*</span></label>
                        <textarea
                            value={message}
                            onChange={handleMessageChange}
                            placeholder="Расскажите, почему вы хотите стать волонтером и как планируете помогать приюту"
                            className={`${validationErrors.message ? 'input-error' : ''}`}
                            rows="4"
                            required
                        ></textarea>
                        {validationErrors.message && (
                            <div className="error-message">{validationErrors.message}</div>
                        )}
                    </div>
                </div>
                
                {error && <p className="volunteer-form-error">{error}</p>}
                
                <div className="volunteer-form-actions">
                    <button
                        type="button"
                        onClick={() => onClose(false)}
                        className="volunteer-form-button cancel"
                        disabled={loading}
                    >
                        Отмена
                    </button>
                    <button
                        type="submit"
                        className="volunteer-form-button submit"
                        disabled={loading}
                    >
                        {loading ? "Отправка..." : "Отправить заявку"}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default VolunteerForm; 