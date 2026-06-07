import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuthContext } from "../../hooks/UseAuthContext";
import "./AdoptForm.css";
import { useAuthModal } from '../../Context/AuthModalContext';
import { getPetImageUrl } from '../../utils/petImageUrl';
import { formatAge } from '../../utils/ageFormatter';
import io from 'socket.io-client';
import { getSocketServerUrl } from '../../utils/socketServerUrl';

const AdoptForm = () => {
  const { petId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { showAuthModal } = useAuthModal();
  
  // Состояние для питомца и приюта
  const [pet, setPet] = useState(null);
  const [shelter, setShelter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Состояние формы
  const [email, setEmail] = useState(user ? user.email : "");
  const [phoneNo, setPhoneNo] = useState("");
  const [livingSituation, setLivingSituation] = useState("");
  const [previousExperience, setPreviousExperience] = useState("");
  const [familyComposition, setFamilyComposition] = useState("");
  
  // Состояние отправки
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasPreviousApplication, setHasPreviousApplication] = useState(false);
  
  // Состояние избранного
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const socketRef = useRef(null);
  
  // Добавляем состояние для ошибок валидации
  const [validationErrors, setValidationErrors] = useState({
    email: '',
    phoneNo: '',
    livingSituation: '',
    previousExperience: '',
    familyComposition: ''
  });
  
  // Функции валидации
  const validateEmail = (value) => {
    if (!value.trim()) return 'Введите email';
    const emailPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailPattern.test(value)) return 'Введите корректный email';
    return '';
  };

  const validatePhone = (value) => {
    if (!value.trim()) return 'Введите номер телефона';
    const phonePattern = /^\+375[0-9]{9}$/;
    if (!phonePattern.test(value)) return 'Введите корректный номер телефона в формате +375XXXXXXXXX';
    return '';
  };

  const validateLivingSituation = (value) => {
    if (!value.trim()) return 'Опишите ваши жилищные условия';
    if (value.length < 10) return 'Описание должно содержать минимум 10 символов';
    return '';
  };

  const validatePreviousExperience = (value) => {
    if (!value.trim()) return 'Расскажите о вашем опыте с животными';
    if (value.length < 10) return 'Описание должно содержать минимум 10 символов';
    return '';
  };

  const validateFamilyComposition = (value) => {
    if (!value.trim()) return 'Опишите состав вашей семьи';
    if (value.length < 10) return 'Описание должно содержать минимум 10 символов';
    return '';
  };
  
  // Получаем информацию о питомце и приюте
  useEffect(() => {
    const fetchPetDetails = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/pets/${petId}`, {
          headers: user && user.token ? { 'Authorization': `Bearer ${user.token}` } : {}
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch pet details');
        }
        
        const petData = await response.json();
        setPet(petData);
        
        // Получаем информацию о приюте
        if (petData.shelter_id) {
          const shelterResponse = await fetch(`/api/shelters/${petData.shelter_id}`, {
            headers: user && user.token ? { 'Authorization': `Bearer ${user.token}` } : {}
          });
          
          if (shelterResponse.ok) {
            const shelterData = await shelterResponse.json();
            setShelter(shelterData);
          }
        }
        
        setError(null);
      } catch (err) {
        console.error("Error fetching pet details:", err);
        setError("Не удалось загрузить информацию о питомце");
      } finally {
        setLoading(false);
      }
    };

    // Проверяем, не подавал ли пользователь заявку на этого питомца ранее
    const checkPreviousApplications = async () => {
      try {
        if (user && user.token) {
          // Use the proper endpoint for user forms with query parameters
          const queryParam = user._id ? `userId=${user._id}` : `email=${user.email}`;
          const response = await fetch(`/api/form/user?${queryParam}`, {
            headers: { 'Authorization': `Bearer ${user.token}` }
          });
          
          if (response.ok) {
            const userApplications = await response.json();
            console.log('Checking previous applications:', userApplications);
            // Check if there's an application with matching petId
            const hasPreviousApp = userApplications.some(app => app.petId === petId);
            console.log('Has previous application:', hasPreviousApp, 'for petId:', petId);
            setHasPreviousApplication(hasPreviousApp);
          }
        }
      } catch (error) {
        console.error("Error checking previous applications:", error);
      }
    };

    fetchPetDetails();
    
    if (user) {
      checkPreviousApplications();
      // Предзаполняем email, если пользователь авторизован
      setEmail(user.email || "");
      // Проверяем, добавлен ли питомец в избранное
      checkFavoriteStatus();
    }
  }, [petId, user]);

  // Проверка статуса избранного
  const checkFavoriteStatus = async () => {
    if (!user || !user.token || !petId) return;
    
    try {
      const response = await fetch(`/api/favorites/check/${petId}`, {
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

  // Инициализация WebSocket для обновлений избранного
  useEffect(() => {
    if (!user?.token) return;

    socketRef.current = io(getSocketServerUrl(), {
      path: '/socket.io',
      auth: {
        token: user.token
      }
    });

    socketRef.current.on('favoriteAdded', (data) => {
      if (data.pet_id === petId && data.user_id === user._id) {
        setIsFavorite(true);
      }
    });

    socketRef.current.on('favoriteRemoved', (data) => {
      if (data.pet_id === petId && data.user_id === user._id) {
        setIsFavorite(false);
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [user, petId]);

  // Обработчик добавления/удаления из избранного
  const handleToggleFavorite = async () => {
    if (!user || !user.token) {
      showAuthModal('добавить питомца в избранное');
      return;
    }

    setFavoriteLoading(true);
    
    try {
      if (isFavorite) {
        // Удаляем из избранного
        const response = await fetch(`/api/favorites/${petId}`, {
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
          body: JSON.stringify({ pet_id: petId })
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
  
  // Обработчики изменения полей формы
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Обновляем значение поля
    switch (name) {
      case 'email':
        setEmail(value);
        setValidationErrors(prev => ({
          ...prev,
          email: validateEmail(value)
        }));
        break;
      case 'phoneNo':
        setPhoneNo(value);
        setValidationErrors(prev => ({
          ...prev,
          phoneNo: validatePhone(value)
        }));
        break;
      case 'livingSituation':
        setLivingSituation(value);
        setValidationErrors(prev => ({
          ...prev,
          livingSituation: validateLivingSituation(value)
        }));
        break;
      case 'previousExperience':
        setPreviousExperience(value);
        setValidationErrors(prev => ({
          ...prev,
          previousExperience: validatePreviousExperience(value)
        }));
        break;
      case 'familyComposition':
        setFamilyComposition(value);
        setValidationErrors(prev => ({
          ...prev,
          familyComposition: validateFamilyComposition(value)
        }));
        break;
      default:
        break;
    }
  };
  
  // Валидация формы
  const validateForm = () => {
    const errors = {
      email: validateEmail(email),
      phoneNo: validatePhone(phoneNo),
      livingSituation: validateLivingSituation(livingSituation),
      previousExperience: validatePreviousExperience(previousExperience),
      familyComposition: validateFamilyComposition(familyComposition)
    };

    setValidationErrors(errors);
    return !Object.values(errors).some(error => error !== '');
  };
  
  // Отправка формы
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!pet || pet.status !== 'Approved') {
      setError(pet?.status === 'Adopted'
        ? 'Этот питомец уже усыновлён'
        : 'Питомец недоступен для подачи заявки');
      return;
    }
    
    if (!user || !user.token) {
      showAuthModal('подать заявку на усыновление');
      return;
    }
    
    if (hasPreviousApplication) {
      setError("Вы уже подавали заявку на усыновление этого питомца");
      return;
    }
    
    // Проверка, не является ли пользователь владельцем питомца
    if (pet && pet.user_id && user._id === pet.user_id) {
      setError("Вы не можете усыновить собственного питомца");
      return;
    }
    
    // Проверка по email, если нет user_id
    if (pet && pet.email && user.email === pet.email) {
      setError("Вы не можете усыновить собственного питомца");
      return;
    }
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const formData = {
        email,
        phoneNo,
        livingSituation,
        previousExperience,
        familyComposition,
        petId
      };
      
      // Add user_id if available
      if (user && user._id) {
        formData.user_id = user._id;
      }
      
      const response = await fetch("/api/form/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();

      if (!response.ok) {
        if (data.error === 'duplicate_application' || data.message === 'You have already submitted an application for this pet') {
          setHasPreviousApplication(true);
          throw new Error("Вы уже подавали заявку на усыновление этого питомца");
        }
        if (data.error === 'pet_already_adopted' || data.error === 'pet_not_available') {
          try {
            const petRes = await fetch(`/api/pets/${petId}`, {
              headers: user?.token ? { Authorization: `Bearer ${user.token}` } : {}
            });
            if (petRes.ok) {
              const updated = await petRes.json();
              setPet(updated);
            }
          } catch (_) { /* ignore */ }
          throw new Error(data.message || "Питомец недоступен для усыновления");
        }
        throw new Error(data.message || "Ошибка при отправке заявки");
      }
      
      setIsSuccess(true);
    } catch (err) {
      setError(err.message || "Произошла ошибка при отправке формы");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Отображение состояния загрузки
  if (loading) {
    return (
      <div className="adopt-page-container">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Загрузка информации о питомце...</p>
        </div>
      </div>
    );
  }
  
  // Отображение ошибки
  if (error && !pet) {
    return (
      <div className="adopt-page-container">
        <div className="error-message">
          <p>{error}</p>
          <button className="back-to-pets-btn" onClick={() => navigate('/pawfinds/pets')}>
            Вернуться к списку питомцев
          </button>
        </div>
      </div>
    );
  }
  
  // Отображение успешной отправки
  if (isSuccess) {
    return (
      <div className="adopt-page-container">
        <div className="success-message">
          <h2>Заявка успешно отправлена!</h2>
          <p>Спасибо за ваш интерес к усыновлению {pet?.name}. Мы свяжемся с вами в ближайшее время для уточнения деталей.</p>
          <button 
            onClick={() => navigate('/pawfinds/pets')} 
            className="back-to-pets-btn"
          >
            Вернуться к списку питомцев
          </button>
        </div>
      </div>
    );
  }

  const canSubmitApplication = pet && pet.status === 'Approved';
  const isAdoptedPet = pet && pet.status === 'Adopted';

  return (
    <div className="adopt-page-container">
      <div className="filter-header">
        <h1 className="adopt-page-title">
          {canSubmitApplication ? 'Заявка на усыновление' : 'Карточка питомца'}
        </h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {user && (
            <button 
              onClick={handleToggleFavorite}
              disabled={favoriteLoading}
              className={`favorite-btn ${isFavorite ? 'favorite-active' : ''}`}
            >
              {favoriteLoading ? (
                '...'
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                  </svg>
                  {isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
                </>
              )}
            </button>
          )}
          <button 
          onClick={() => navigate('/pawfinds/pets')} 
          className="reset-filter-btn"
        >
          Вернуться к питомцам
        </button>
        </div>
      </div>
      
      <div className="adopt-content-layout">
        {/* Левая сторона - информация о питомце */}
        <div className="pet-info-column">
          <div className="pet-image-container">
            {isAdoptedPet && (
              <span className="pet-status-ribbon pet-status-ribbon-adopted">Усыновлён</span>
            )}
            <img 
              src={getPetImageUrl(pet.filename)} 
              alt={pet.name}
              onError={(e) => {
                e.target.src = "/api/images/default.jpg";
              }}
            />
          </div>
          
          <div className="pet-details-container">
            <h2>{pet.name}</h2>
            <ul className="pet-details-list">
              {pet.type && <li><span>Тип:</span> {pet.type}</li>}
              {pet.species && <li><span>Вид:</span> {pet.species}</li>}
              {pet.breed && <li><span>Порода:</span> {pet.breed}</li>}
              {pet.birthDate && <li><span>Возраст:</span> {formatAge(pet.birthDate)}</li>}
              {pet.area && <li><span>Локация:</span> {pet.area}</li>}
              {shelter && (
                <>
                  <li><span>Приют:</span> {shelter.name}</li>
                  <li><span>Адрес:</span> {shelter.city}, {shelter.street}, {shelter.house}</li>
                  <li><span>Телефон:</span> {shelter.phone}</li>
                </>
              )}
            </ul>
            
            {/* Характеристики питомца */}
            <div className="pet-characteristics">
              <h3>Характеристики</h3>
              <div className="characteristics-grid">
                {pet.size && (
                  <div className="characteristic-item">
                    <span className="characteristic-label">Размер:</span>
                    <span className="characteristic-badge">
                      {pet.size === 'small' ? 'Маленький' : 
                       pet.size === 'medium' ? 'Средний' : 
                       pet.size === 'large' ? 'Крупный' : 
                       pet.size === 'giant' ? 'Очень крупный' : pet.size}
                    </span>
                  </div>
                )}
                {pet.energyLevel && (
                  <div className="characteristic-item">
                    <span className="characteristic-label">Энергичность:</span>
                    <span className="characteristic-badge">
                      {pet.energyLevel === 'low' ? 'Низкий' : 
                       pet.energyLevel === 'medium' ? 'Средний' : 
                       pet.energyLevel === 'high' ? 'Высокий' : pet.energyLevel}
                    </span>
                  </div>
                )}
                {pet.careLevel && (
                  <div className="characteristic-item">
                    <span className="characteristic-label">Забота:</span>
                    <span className="characteristic-badge">
                      {pet.careLevel === 'low' ? 'Низкий' : 
                       pet.careLevel === 'medium' ? 'Средний' : 
                       pet.careLevel === 'high' ? 'Высокий' : pet.careLevel}
                    </span>
                  </div>
                )}
                {pet.activityNeeds && (
                  <div className="characteristic-item">
                    <span className="characteristic-label">Активность:</span>
                    <span className="characteristic-badge">
                      {pet.activityNeeds === 'low' ? 'Низкая' : 
                       pet.activityNeeds === 'moderate' ? 'Средняя' : 
                       pet.activityNeeds === 'high' ? 'Высокая' : pet.activityNeeds}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Дополнительные условия */}
              <div className="pet-flags">
                {pet.isKidFriendly && (
                  <span className="pet-flag">Подходит детям</span>
                )}
                {pet.isPetFriendly && (
                  <span className="pet-flag">Дружит с животными</span>
                )}
                {pet.hypoallergenic && (
                  <span className="pet-flag hypoallergenic">Гипоаллергенный</span>
                )}
              </div>
              
              {/* Темперамент */}
              {pet.temperamentTraits && pet.temperamentTraits.length > 0 && (
                <div className="pet-temperament">
                  <span className="characteristic-label">Темперамент:</span>
                  <div className="temperament-tags">
                    {pet.temperamentTraits.map((trait, index) => (
                      <span key={index} className="temperament-tag">{trait}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {pet.description && (
              <div className="pet-description">
                <h3>О питомце</h3>
                <p>{pet.description}</p>
              </div>
            )}
            
            {pet.medicalNotes && (
              <div className="pet-medical-notes">
                <h3>Медицинская информация</h3>
                <p>{pet.medicalNotes}</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Правая сторона - форма */}
        <div className="form-column">
          <div className="adopt-form-container">
            <h2 className="form-title">
              {canSubmitApplication ? 'Форма заявки' : 'Усыновление'}
            </h2>
            
            {!canSubmitApplication ? (
              <div className={`adopt-unavailable-panel ${isAdoptedPet ? 'adopt-unavailable-adopted' : ''}`}>
                <h3>{isAdoptedPet ? 'Питомец уже нашёл дом' : 'Заявку сейчас подать нельзя'}</h3>
                <p>
                  {isAdoptedPet
                    ? `${pet.name} уже усыновлён и не ищет новую семью через эту анкету. Вы можете убрать его из избранного или посмотреть других питомцев в каталоге.`
                    : 'Этот питомец ещё не доступен для усыновления (на модерации или снят с публикации). Следите за обновлениями или выберите другого друга.'}
                </p>
                <div className="adopt-unavailable-actions">
                  <button type="button" onClick={() => navigate('/pawfinds/pets')} className="adopt-form-button">
                    К каталогу питомцев
                  </button>
                  <button type="button" onClick={() => navigate(-1)} className="back-to-pets-btn">
                    Назад
                  </button>
                </div>
              </div>
            ) : hasPreviousApplication ? (
              <div className="previous-application-alert">
                <h3>Вы уже подавали заявку</h3>
                <p>Вы уже подали заявку на усыновление этого питомца. Вы можете проверить статус заявки в своем профиле.</p>
                <div className="previous-application-actions">
                  <button 
                    onClick={() => navigate("/pawfinds/profile")} 
                    className="go-to-profile-btn"
                  >
                    Перейти в профиль
                  </button>
                  <button 
                    onClick={() => navigate("/pawfinds/pets")} 
                    className="back-to-pets-btn"
                  >
                    Вернуться к питомцам
                  </button>
                </div>
              </div>
            ) : (
              <form className="adopt-form" onSubmit={handleSubmit}>
                <div className="adopt-form-header">
                  <h2>Заявка на усыновление</h2>
                  <p>Пожалуйста, заполните форму, чтобы мы могли рассмотреть вашу заявку на усыновление.</p>
                </div>

                {error && <div className="adopt-form-error">{error}</div>}

                <div className="adopt-form-section">
                  <h3>Контактная информация</h3>
                  <div className="adopt-form-row">
                    <div className="adopt-form-group">
                      <label htmlFor="email-input">Email для связи</label>
                      <input
                        id="email-input"
                        type="email"
                        name="email"
                        value={email}
                        onChange={handleInputChange}
                        className={`adopt-form-input ${validationErrors.email ? 'input-error' : ''}`}
                        readOnly
                      />
                      {validationErrors.email && (
                        <div className="error-message">{validationErrors.email}</div>
                      )}
                      <small className="adopt-form-help-text">Используется email из вашего профиля</small>
                    </div>

                    <div className="adopt-form-group">
                      <label>Номер телефона</label>
                      <input
                        type="tel"
                        name="phoneNo"
                        value={phoneNo}
                        onChange={handleInputChange}
                        placeholder="+375 (XX) XXX-XX-XX"
                        className={`adopt-form-input ${validationErrors.phoneNo ? 'input-error' : ''}`}
                      />
                      {validationErrors.phoneNo && (
                        <div className="error-message">{validationErrors.phoneNo}</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="adopt-form-section">
                  <h3>Информация о вас</h3>
                  <div className="adopt-form-group">
                    <label>Жилищные условия</label>
                    <textarea
                      name="livingSituation"
                      value={livingSituation}
                      onChange={handleInputChange}
                      placeholder="Опишите ваши жилищные условия (тип жилья, площадь, наличие двора и т.д.)"
                      rows="3"
                      className={`adopt-form-input ${validationErrors.livingSituation ? 'input-error' : ''}`}
                    />
                    {validationErrors.livingSituation && (
                      <div className="error-message">{validationErrors.livingSituation}</div>
                    )}
                  </div>

                  <div className="adopt-form-group">
                    <label>Опыт с животными</label>
                    <textarea
                      name="previousExperience"
                      value={previousExperience}
                      onChange={handleInputChange}
                      placeholder="Расскажите о вашем опыте содержания животных"
                      rows="3"
                      className={`adopt-form-input ${validationErrors.previousExperience ? 'input-error' : ''}`}
                    />
                    {validationErrors.previousExperience && (
                      <div className="error-message">{validationErrors.previousExperience}</div>
                    )}
                  </div>

                  <div className="adopt-form-group">
                    <label>Состав семьи</label>
                    <textarea
                      name="familyComposition"
                      value={familyComposition}
                      onChange={handleInputChange}
                      placeholder="Опишите состав вашей семьи (количество человек, возраст, отношение к животным)"
                      rows="3"
                      className={`adopt-form-input ${validationErrors.familyComposition ? 'input-error' : ''}`}
                    />
                    {validationErrors.familyComposition && (
                      <div className="error-message">{validationErrors.familyComposition}</div>
                    )}
                  </div>
                </div>

                <div className="adopt-form-actions">
                  <button 
                    type="submit" 
                    className="adopt-form-button"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Отправка..." : "Отправить заявку"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdoptForm;
