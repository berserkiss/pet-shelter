import React, { useState, useEffect, useRef, useMemo } from "react";
import { useAuthContext } from "../../hooks/UseAuthContext";
import { useAuthModal } from '../../Context/AuthModalContext';
import io from 'socket.io-client';
import axios from 'axios';
import { getSocketServerUrl } from '../../utils/socketServerUrl';
import { Link } from "react-router-dom";
import StyledSelect from "../UI/StyledSelect";
import "./PostPetSection.css";

const POST_PET_SIZE_OPTIONS = [
  { value: "small", label: "Маленький" },
  { value: "medium", label: "Средний" },
  { value: "large", label: "Крупный" },
  { value: "giant", label: "Очень крупный" }
];

const POST_PET_ENERGY_OPTIONS = [
  { value: "low", label: "Низкий" },
  { value: "medium", label: "Средний" },
  { value: "high", label: "Высокий" }
];

const POST_PET_CARE_OPTIONS = [
  { value: "low", label: "Низкий" },
  { value: "medium", label: "Средний" },
  { value: "high", label: "Высокий" }
];

const POST_PET_ACTIVITY_OPTIONS = [
  { value: "low", label: "Низкая" },
  { value: "moderate", label: "Средняя" },
  { value: "high", label: "Высокая" }
];

const PostPetSection = () => {
  const { user, dispatch } = useAuthContext();
  const { showAuthModal } = useAuthModal();
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [area, setArea] = useState("");
  const [justification, setJustification] = useState("");
  const [email, setEmail] = useState(user ? user.email : "");
  const [phone, setPhone] = useState("");
  const [formError, setFormError] = useState(false);
  const [species, setSpecies] = useState("");
  const [customSpecies, setCustomSpecies] = useState("");
  const [showCustomSpecies, setShowCustomSpecies] = useState(false);
  const [availableSpecies, setAvailableSpecies] = useState([]);
  const [breed, setBreed] = useState("");
  const [customBreed, setCustomBreed] = useState("");
  const [showCustomBreed, setShowCustomBreed] = useState(false);
  const [availableBreeds, setAvailableBreeds] = useState([]);
  const [description, setDescription] = useState("");
  const [picture, setPicture] = useState(null);
  const [fileName, setFileName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shelters, setShelters] = useState([]);
  const [shelterId, setShelterId] = useState("");
  const [shelterCapacityError, setShelterCapacityError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const socketRef = useRef(null);

  // Новые поля из фильтрации
  const [size, setSize] = useState("medium");
  const [energyLevel, setEnergyLevel] = useState("medium");
  const [careLevel, setCareLevel] = useState("medium");
  const [activityNeeds, setActivityNeeds] = useState("moderate");
  const [temperamentTraits, setTemperamentTraits] = useState([]);
  const [availableTemperaments, setAvailableTemperaments] = useState([]);
  const [newTemperament, setNewTemperament] = useState("");
  const [showNewTemperamentInput, setShowNewTemperamentInput] = useState(false);
  const [temperamentError, setTemperamentError] = useState("");
  const [isKidFriendly, setIsKidFriendly] = useState(true);
  const [isPetFriendly, setIsPetFriendly] = useState(true);
  const [hypoallergenic, setHypoallergenic] = useState(false);
  const [medicalNotes, setMedicalNotes] = useState("");

  // Добавляем состояние для ошибок валидации
  const [validationErrors, setValidationErrors] = useState({
    name: '',
    birthDate: '',
    area: '',
    justification: '',
    email: '',
    phone: '',
    species: '',
    breed: '',
    description: '',
    picture: '',
    shelterId: ''
  });

  const speciesSelectOptions = useMemo(
    () => [
      { value: '', label: 'Выберите вид животного' },
      ...availableSpecies.map((s) => ({ value: s, label: s })),
      { value: 'Другое', label: 'Другое' }
    ],
    [availableSpecies]
  );

  const breedSelectOptions = useMemo(
    () => [
      { value: '', label: 'Выберите породу' },
      ...availableBreeds.map((b) => ({ value: b, label: b })),
      { value: 'Другое', label: 'Другое' }
    ],
    [availableBreeds]
  );

  const shelterSelectOptions = useMemo(
    () => [
      { value: '', label: 'Выберите приют' },
      ...shelters.map((sh) => ({
        value: String(sh._id),
        label: `${sh.name} (${sh.current_capacity}/${sh.max_capacity})`
      }))
    ],
    [shelters]
  );

  // Функции валидации
  const validateName = (value) => {
    if (!value.trim()) return 'Введите имя питомца';
    if (value.length < 2) return 'Имя должно содержать минимум 2 символа';
    if (value.length > 50) return 'Имя не должно превышать 50 символов';
    return '';
  };

  const validateBirthDate = (value) => {
    if (!value) return 'Выберите дату рождения';
    const date = new Date(value);
    const today = new Date();
    if (date > today) return 'Дата рождения не может быть в будущем';
    return '';
  };

  const validateArea = (value) => {
    if (!value.trim()) return 'Укажите местоположение';
    if (value.length < 3) return 'Местоположение должно содержать минимум 3 символа';
    return '';
  };

  const validateJustification = (value) => {
    if (!value.trim()) return 'Укажите причину размещения питомца';
    if (value.length < 10) return 'Описание причины должно содержать минимум 10 символов';
    return '';
  };

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

  const validateSpecies = (value, customValue) => {
    if (!value && !customValue) return 'Выберите вид животного';
    if (value === 'Другое' && !customValue.trim()) return 'Укажите вид животного';
    return '';
  };

  const validateBreed = (value, customValue) => {
    if (!value && !customValue) return 'Выберите породу';
    if (value === 'Другое' && !customValue.trim()) return 'Укажите породу';
    return '';
  };

  const validateDescription = (value) => {
    if (!value.trim()) return 'Добавьте описание питомца';
    if (value.length < 20) return 'Описание должно содержать минимум 20 символов';
    return '';
  };

  const validatePicture = (value) => {
    if (!value) return 'Добавьте фотографию питомца';
    return '';
  };

  const validateShelter = (value) => {
    if (!value) return 'Выберите приют';
    return '';
  };

  // Обработчики изменений полей с валидацией
  const handleNameChange = (e) => {
    const value = e.target.value;
    setName(value);
    setValidationErrors(prev => ({
      ...prev,
      name: validateName(value)
    }));
  };

  const handleBirthDateChange = (e) => {
    const value = e.target.value;
    setBirthDate(value);
    setValidationErrors(prev => ({
      ...prev,
      birthDate: validateBirthDate(value)
    }));
  };

  const handleAreaChange = (e) => {
    const value = e.target.value;
    setArea(value);
    setValidationErrors(prev => ({
      ...prev,
      area: validateArea(value)
    }));
  };

  const handleJustificationChange = (e) => {
    const value = e.target.value;
    setJustification(value);
    setValidationErrors(prev => ({
      ...prev,
      justification: validateJustification(value)
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

  const handleSpeciesChange = (e) => {
    const selectedSpecies = e.target.value;
    setSpecies(selectedSpecies);
    
    if (selectedSpecies === "Другое") {
      setShowCustomSpecies(true);
      setCustomSpecies("");
    } else {
      setShowCustomSpecies(false);
    }

    setValidationErrors(prev => ({
      ...prev,
      species: validateSpecies(selectedSpecies, customSpecies)
    }));
  };

  const handleCustomSpeciesChange = (e) => {
    const value = e.target.value;
    setCustomSpecies(value);
    setValidationErrors(prev => ({
      ...prev,
      species: validateSpecies(species, value)
    }));
  };

  const handleBreedChange = (e) => {
    const selectedBreed = e.target.value;
    setBreed(selectedBreed);
    
    if (selectedBreed === "Другое") {
      setShowCustomBreed(true);
      setCustomBreed("");
    } else {
      setShowCustomBreed(false);
    }

    setValidationErrors(prev => ({
      ...prev,
      breed: validateBreed(selectedBreed, customBreed)
    }));
  };

  const handleCustomBreedChange = (e) => {
    const value = e.target.value;
    setCustomBreed(value);
    setValidationErrors(prev => ({
      ...prev,
      breed: validateBreed(breed, value)
    }));
  };

  const handleDescriptionChange = (e) => {
    const value = e.target.value;
    setDescription(value);
    setValidationErrors(prev => ({
      ...prev,
      description: validateDescription(value)
    }));
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setPicture(selectedFile);
      setFileName(selectedFile.name);
      setValidationErrors(prev => ({
        ...prev,
        picture: validatePicture(selectedFile)
      }));
    }
  };

  const handleShelterChange = (e) => {
    const value = e.target.value;
    setShelterId(value);
    setValidationErrors(prev => ({
      ...prev,
      shelterId: validateShelter(value)
    }));
  };

  // Обработчики для новых полей
  const handleTemperamentToggle = (trait) => {
    setTemperamentTraits(prev => {
      // Предотвращаем дубликаты
      if (prev.includes(trait)) {
        return prev.filter(t => t !== trait);
      } else {
        return [...prev, trait];
      }
    });
  };

  const handleAddNewTemperament = () => {
    const trimmedTrait = newTemperament.trim();
    if (!trimmedTrait) {
      setTemperamentError('Введите характеристику');
      return;
    }
    
    setTemperamentError('');
    
    // Проверяем формат: либо "xxx(-ая)" либо просто "xxx"
    let baseTrait = trimmedTrait;
    if (trimmedTrait.includes('(-')) {
      // Извлекаем базовую часть до "(-"
      baseTrait = trimmedTrait.split('(-')[0].trim();
    }
    
    // Проверяем, что характеристика заканчивается на "ий", "ый", "ая" или "яя"
    if (!baseTrait.endsWith('ий') && !baseTrait.endsWith('ый') && !baseTrait.endsWith('ая') && !baseTrait.endsWith('яя')) {
      setTemperamentError('Характеристика должна заканчиваться на "ий", "ый", "ая" или "яя" (например: дружелюбный, привязчивая)');
      return;
    }
    
    // Форматируем черту характера в формате "умный(-ая)"
    const formattedTrait = formatTemperamentTrait(trimmedTrait);
    
    // Проверяем на дубликаты в доступных характеристиках
    if (availableTemperaments.includes(formattedTrait)) {
      setTemperamentError('Эта характеристика уже существует');
      return;
    }
    
    // Проверяем на дубликаты в выбранных характеристиках
    if (temperamentTraits.includes(formattedTrait)) {
      setTemperamentError('Эта характеристика уже добавлена');
      return;
    }
    
    setAvailableTemperaments(prev => [...prev, formattedTrait].sort());
    setTemperamentTraits(prev => [...prev, formattedTrait]);
    setNewTemperament("");
    setShowNewTemperamentInput(false);
    setTemperamentError('');
  };

  // Функция для форматирования черты характера в формат "умный(-ая)"
  const formatTemperamentTrait = (trait) => {
    // Если уже в правильном формате, возвращаем как есть
    if (trait.includes('(-')) {
      return trait;
    }
    
    // Если заканчивается на "ая" или "яя" - заменяем на мужской род с форматом "(-ая)"
    if (trait.endsWith('ая')) {
      const base = trait.slice(0, -2);
      return `${base}ый(-ая)`;
    } else if (trait.endsWith('яя')) {
      const base = trait.slice(0, -2);
      return `${base}ий(-ая)`;
    }
    
    // Если заканчивается на "ый" или "ий" - добавляем формат "(-ая)"
    if (trait.endsWith('ый') || trait.endsWith('ий')) {
      return `${trait}(-ая)`;
    }
    
    // Если не подходит ни под один формат, возвращаем как есть (валидация будет в handleAddNewTemperament)
    return trait;
  };

  // Инициализация WebSocket соединения
  useEffect(() => {
    // Подключаемся к сокет-серверу
    const socket = io(getSocketServerUrl(), {
      path: '/socket.io',
      auth: {
        token: user && user.token ? user.token : undefined
      }
    });
    
    socketRef.current = socket;
    
    // Явно присоединяемся к комнате shelters
    socket.emit('joinRoom', 'shelters');
    
    // Обработка ошибок соединения
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
    
    // Слушаем обновления приютов
    socket.on('shelterUpdate', (updatedShelter) => {
      console.log('Received shelter update in PostPetSection:', updatedShelter);
      
      setShelters(prevShelters => {
        // Проверяем, есть ли уже такой приют в списке
        const existingIndex = prevShelters.findIndex(shelter => shelter._id === updatedShelter._id);
        
        if (existingIndex >= 0) {
          // Обновляем существующий приют
          const updatedShelters = [...prevShelters];
          updatedShelters[existingIndex] = updatedShelter;
          return updatedShelters;
        } else {
          // Добавляем новый приют
          return [...prevShelters, updatedShelter];
        }
      });
    });
    
    // Слушаем удаление приютов
    socket.on('shelterDeleted', ({ id }) => {
      setShelters(prevShelters => prevShelters.filter(shelter => shelter._id !== id));
    });
    
    // Очистка при размонтировании
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [user]);

  useEffect(() => {
    const fetchShelters = async () => {
      if (!user || !user.token) return;
      
      try {
        const response = await fetch('/api/shelters', {
          headers: {
            'Authorization': `Bearer ${user.token}`
          }
        });
        
        // Handle token expiration
        if (response.status === 401) {
          try {
            console.log('Token expired during shelter fetch, attempting to refresh...');
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
              console.log('Token refreshed, retrying shelter fetch...');
              fetchShelters();
              return;
            }
          } catch (refreshError) {
            console.error('Failed to refresh token:', refreshError);
          }
        }
        
        if (response.ok) {
        const data = await response.json();
        setShelters(data);
        }
      } catch (error) {
        console.error("Error fetching shelters:", error);
      }
    };

    fetchShelters();
  }, [user, dispatch]);

  // Загрузка видов животных
  useEffect(() => {
    const fetchSpecies = async () => {
      if (!user || !user.token) return;
      
      try {
        const response = await fetch('/api/pets/species', {
          headers: {
            'Authorization': `Bearer ${user.token}`
          }
        });
        
        // Handle token expiration
        if (response.status === 401) {
          try {
            console.log('Token expired during species fetch, attempting to refresh...');
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
              console.log('Token refreshed, retrying species fetch...');
              fetchSpecies();
              return;
            }
          } catch (refreshError) {
            console.error('Failed to refresh token:', refreshError);
          }
        }
        
        if (response.ok) {
          const speciesList = await response.json();
          setAvailableSpecies(speciesList);
        }
      } catch (error) {
        console.error("Error fetching species:", error);
      }
    };
    
    fetchSpecies();
  }, [user, dispatch]);

  // Получаем породы при изменении типа животного
  useEffect(() => {
    const fetchBreeds = async () => {
      if (!species || !user || !user.token) return;
      
      try {
        const response = await fetch(`/api/pets/breeds/${species}`, {
          headers: {
            'Authorization': `Bearer ${user.token}`
          }
        });
        
        // Handle token expiration
        if (response.status === 401) {
          try {
            console.log('Token expired during breeds fetch, attempting to refresh...');
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
              console.log('Token refreshed, retrying breeds fetch...');
              fetchBreeds();
              return;
            }
          } catch (refreshError) {
            console.error('Failed to refresh token:', refreshError);
          }
        }
        
        if (response.ok) {
          const breeds = await response.json();
          setAvailableBreeds(breeds);
        }
      } catch (error) {
        console.error("Error fetching breeds:", error);
      }
    };
    
    fetchBreeds();
    
    // Сбрасываем выбранную породу при изменении типа
    setBreed("");
    setCustomBreed("");
    setShowCustomBreed(false);
  }, [species, user, dispatch]);

  // Загрузка черт характера из БД
  useEffect(() => {
    const fetchTemperaments = async () => {
      if (!user || !user.token) return;
      
      try {
        const response = await fetch('/api/pets/temperaments', {
          headers: {
            'Authorization': `Bearer ${user.token}`
          }
        });
        
        if (response.ok) {
          const temperaments = await response.json();
          setAvailableTemperaments(temperaments);
        }
      } catch (error) {
        console.error("Error fetching temperaments:", error);
      }
    };
    
    fetchTemperaments();
  }, [user]);

  useEffect(() => {
    if (!isSubmitting) {
      setFormError(false);
    }
  }, [isSubmitting]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!user || !user.token) {
      showAuthModal('разместить объявление о питомце');
      return;
    }

    // Определяем итоговый вид (стандартный или кастомный)
    const finalSpecies = (species === "Другое") ? customSpecies : species;
    
    // Определяем итоговую породу (стандартная или кастомная)
    const finalBreed = (breed === "Другое") ? customBreed : breed;

    // Валидация всех полей
    const errors = {
      name: validateName(name),
      birthDate: validateBirthDate(birthDate),
      area: validateArea(area),
      justification: validateJustification(justification),
      email: validateEmail(email),
      phone: validatePhone(phone),
      species: validateSpecies(species, customSpecies),
      breed: validateBreed(breed, customBreed),
      description: validateDescription(description),
      picture: validatePicture(picture),
      shelterId: validateShelter(shelterId)
    };

    setValidationErrors(errors);

    // Проверяем, есть ли ошибки
    const hasErrors = Object.values(errors).some(error => error !== '');
    if (hasErrors) {
      setFormError(true);
      return;
    }

    // Сбрасываем флаги ошибок
    setFormError(false);
    setIsSubmitting(true);
    setShelterCapacityError("");

    try {
      // Сразу подготавливаем данные формы
      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("birthDate", birthDate);
      formData.append("area", area.trim());
      formData.append("justification", justification.trim());
      formData.append("email", email.trim());
      formData.append("phone", phone.trim());
      formData.append("type", finalSpecies);
      formData.append("species", finalSpecies);
      formData.append("breed", finalBreed.trim());
      formData.append("description", description.trim());
      formData.append("shelter_id", shelterId);
      
      // Добавляем новые поля
      formData.append("size", size);
      formData.append("energyLevel", energyLevel);
      formData.append("careLevel", careLevel);
      formData.append("activityNeeds", activityNeeds);
      formData.append("isKidFriendly", isKidFriendly);
      formData.append("isPetFriendly", isPetFriendly);
      formData.append("hypoallergenic", hypoallergenic);
      formData.append("medicalNotes", medicalNotes.trim());
      
      // Добавляем черты характера (массив)
      temperamentTraits.forEach(trait => {
        formData.append("temperamentTraits[]", trait);
      });

      // Добавляем идентификатор пользователя если он авторизован
      if (user && user._id) {
        formData.append("user_id", user._id);
      }

      if (picture) {
        formData.append("picture", picture);
      }

      // Отправляем данные
      const response = await fetch("/api/admin-pets/services", {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${user.token}`
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to submit pet");
      }

      // Успешная отправка
      resetForm();
      setIsSuccess(true);
    } catch (error) {
      console.error("Error submitting form:", error);
      if (error.message.includes('capacity') || error.message.includes('вместимост')) {
        setShelterCapacityError("Ошибка: Выбранный приют заполнен до максимальной вместимости. Пожалуйста, выберите другой приют.");
      } else {
        setFormError(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setName("");
    setBirthDate("");
    setArea("");
    setJustification("");
    setEmail(user ? user.email : "");
    setPhone("");
    setSpecies("");
    setCustomSpecies("");
    setShowCustomSpecies(false);
    setBreed("");
    setCustomBreed("");
    setShowCustomBreed(false);
    setDescription("");
    setShelterId("");
    setPicture(null);
    setFileName("");
    setFormError(false);
    setShelterCapacityError("");
    // Сброс новых полей
    setSize("medium");
    setEnergyLevel("medium");
    setCareLevel("medium");
    setActivityNeeds("moderate");
    setTemperamentTraits([]);
    setIsKidFriendly(true);
    setIsPetFriendly(true);
    setHypoallergenic(false);
    setMedicalNotes("");
    setNewTemperament("");
    setShowNewTemperamentInput(false);
  };

  // Инициализация сокета
  useEffect(() => {
    // Подключаемся к сокет-серверу
    const socket = io(getSocketServerUrl(), {
      path: '/socket.io',
      auth: {
        token: user && user.token ? user.token : undefined
      }
    });
    
    socketRef.current = socket;
    
    // Слушаем обновления видов и пород животных
    socket.on('speciesBreedUpdate', ({ species: newSpecies, breed: newBreed }) => {
      console.log('Получено обновление видов и пород:', newSpecies, newBreed);
      
      // Обновляем список видов
      if (newSpecies) {
        setAvailableSpecies(prevSpecies => {
          if (!prevSpecies.includes(newSpecies)) {
            return [...prevSpecies, newSpecies].sort();
          }
          return prevSpecies;
        });
      }
      
      // Обновляем список пород, если у нас выбран соответствующий вид
      if (newBreed && species === newSpecies) {
        setAvailableBreeds(prevBreeds => {
          if (!prevBreeds.includes(newBreed)) {
            return [...prevBreeds, newBreed].sort();
          }
          return prevBreeds;
        });
      }
    });
    
    // Слушаем обновления черт характера
    socket.on('temperamentUpdate', ({ temperament: newTemperament }) => {
      console.log('Получено обновление черты характера:', newTemperament);
      
      if (newTemperament) {
        setAvailableTemperaments(prevTemperaments => {
          if (!prevTemperaments.includes(newTemperament)) {
            return [...prevTemperaments, newTemperament].sort();
          }
          return prevTemperaments;
        });
      }
    });
    
    // Очистка при размонтировании
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [user, species]);

  // Добавляем класс к body для фонового SVG
  useEffect(() => {
    document.body.classList.add('post-pet-page');
    return () => {
      document.body.classList.remove('post-pet-page');
    };
  }, []);

  if (!user) {
    return (
      <div className="auth-required-container">
        <div className="auth-required-message">
          <div className="auth-icon">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="#6504b5" strokeWidth="2"/>
              <path d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11" stroke="#6504b5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="16" r="1.5" fill="#6504b5"/>
            </svg>
          </div>
          <h2>Требуется авторизация</h2>
          <p>Для размещения объявления о питомце необходимо войти в систему.</p>
          <p>Пожалуйста, войдите или создайте аккаунт для доступа к этой функции.</p>
          <div className="auth-actions">
            <Link to="/pawfinds/auth" className="auth-button primary">Войти / Зарегистрироваться</Link>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="adopt-form-success">
        <h2>Заявка успешно отправлена!</h2>
        <p>
          Спасибо за информацию о питомце. Мы рассмотрим заявку в ближайшее время.
        </p>
        <p>
          Если ваша заявка будет одобрена, мы отправим вам уведомление по электронной почте.
        </p>
        <button 
          className="adopt-form-button"
          onClick={() => setIsSuccess(false)}
        >
          Разместить еще одно объявление
        </button>
      </div>
    );
  }

  return (
    <div className="post-pet-wrapper">
      <form className="adopt-form" onSubmit={handleSubmit}>
        <div className="adopt-form-header">
          <h2>Размещение объявления о питомце</h2>
          <p>Пожалуйста, заполните все поля формы, чтобы мы могли найти новый дом для питомца.</p>
        </div>

        <div className="adopt-form-section">
          <h3>Основная информация о питомце</h3>

        <div className="adopt-form-row">
          <div className="adopt-form-group">
            <label>Имя питомца</label>
            <input
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder="Введите имя питомца"
              className={`adopt-form-input ${validationErrors.name ? 'input-error' : ''}`}
            />
            {validationErrors.name && (
              <div className="error-message">{validationErrors.name}</div>
            )}
          </div>

          <div className="adopt-form-group">
            <label>Дата рождения</label>
            <input
              type="date"
              value={birthDate}
              onChange={handleBirthDateChange}
              max={new Date().toISOString().split('T')[0]}
              className={`adopt-form-input ${validationErrors.birthDate ? 'input-error' : ''}`}
            />
            {validationErrors.birthDate && (
              <div className="error-message">{validationErrors.birthDate}</div>
            )}
            <small className="field-hint">Выберите приблизительную дату рождения питомца</small>
          </div>
        </div>

        <div className="adopt-form-row">
          <div className="adopt-form-group">
            <label htmlFor="post-pet-species">Вид животного</label>
            <StyledSelect
              id="post-pet-species"
              value={species}
              onChange={(v) => handleSpeciesChange({ target: { value: v } })}
              options={speciesSelectOptions}
              triggerClassName={`adopt-form-input ${validationErrors.species ? 'input-error' : ''}`.trim()}
              aria-label="Вид животного"
            />
            {showCustomSpecies && (
              <input
                type="text"
                value={customSpecies}
                onChange={handleCustomSpeciesChange}
                placeholder="Укажите вид животного"
                className={`adopt-form-input custom-input ${validationErrors.species ? 'input-error' : ''}`}
              />
            )}
            {validationErrors.species && (
              <div className="error-message">{validationErrors.species}</div>
            )}
          </div>

          <div className="adopt-form-group">
            <label htmlFor="post-pet-breed">Порода</label>
            {species ? (
              <>
                <StyledSelect
                  id="post-pet-breed"
                  value={breed}
                  onChange={(v) => handleBreedChange({ target: { value: v } })}
                  options={breedSelectOptions}
                  triggerClassName={`adopt-form-input ${validationErrors.breed ? 'input-error' : ''}`.trim()}
                  aria-label="Порода"
                />
                
                {showCustomBreed && (
                  <div className="custom-breed-input">
                    <input
                      type="text"
                      value={customBreed}
                      onChange={handleCustomBreedChange}
                      placeholder="Введите породу"
                      className={`adopt-form-input ${validationErrors.breed ? 'input-error' : ''}`}
                    />
                  </div>
                )}
                {validationErrors.breed && (
                  <div className="error-message">{validationErrors.breed}</div>
                )}
              </>
            ) : (
              <input
                type="text"
                value=""
                disabled
                placeholder="Сначала выберите вид животного"
                className="adopt-form-input"
              />
            )}
          </div>
        </div>

        <div className="adopt-form-row">
          <div className="adopt-form-group">
            <label>Местоположение</label>
            <input
              type="text"
              value={area}
              onChange={handleAreaChange}
              placeholder="Город, район"
              className={`adopt-form-input ${validationErrors.area ? 'input-error' : ''}`}
            />
            {validationErrors.area && (
              <div className="error-message">{validationErrors.area}</div>
            )}
          </div>

          <div className="adopt-form-group">
            <label htmlFor="post-pet-shelter">Приют</label>
            <StyledSelect
              id="post-pet-shelter"
              value={shelterId != null && shelterId !== '' ? String(shelterId) : ''}
              onChange={(v) => handleShelterChange({ target: { value: v } })}
              options={shelterSelectOptions}
              triggerClassName={`adopt-form-input ${validationErrors.shelterId ? 'input-error' : ''}`.trim()}
              aria-label="Приют"
            />
            {validationErrors.shelterId && (
              <div className="error-message">{validationErrors.shelterId}</div>
            )}
            {shelterCapacityError && (
              <div className="error-message">{shelterCapacityError}</div>
            )}
          </div>
        </div>

        <div className="adopt-form-group">
          <label>Описание питомца</label>
          <textarea
            value={description}
            onChange={handleDescriptionChange}
            placeholder="Опишите питомца, его характер, привычки, особенности поведения..."
            rows="4"
            className={`adopt-form-input ${validationErrors.description ? 'input-error' : ''}`}
          />
          {validationErrors.description && (
            <div className="error-message">{validationErrors.description}</div>
          )}
          <small className="field-hint">Чем подробнее описание, тем больше шансов найти подходящий дом</small>
        </div>

        <div className="adopt-form-group">
          <label>Фотография питомца</label>
          <div className="adopt-form-file-input">
            <input
              type="file"
              id="pet-photo"
              accept="image/*"
              onChange={handleFileChange}
              className={`file-input ${validationErrors.picture ? 'input-error' : ''}`}
            />
            <label htmlFor="pet-photo" className="adopt-form-file-label">
              {fileName ? fileName : "Выберите фотографию питомца"}
            </label>
          </div>
          {validationErrors.picture && (
            <div className="error-message">{validationErrors.picture}</div>
          )}
        </div>
      </div>

      <div className="adopt-form-section">
        <h3>Физические характеристики</h3>
        
        <div className="adopt-form-row">
          <div className="adopt-form-group">
            <label htmlFor="post-pet-size">Размер</label>
            <StyledSelect
              id="post-pet-size"
              value={size}
              onChange={setSize}
              options={POST_PET_SIZE_OPTIONS}
              triggerClassName="adopt-form-input"
              aria-label="Размер"
            />
          </div>

          <div className="adopt-form-group">
            <label htmlFor="post-pet-energy">Энергичность</label>
            <StyledSelect
              id="post-pet-energy"
              value={energyLevel}
              onChange={setEnergyLevel}
              options={POST_PET_ENERGY_OPTIONS}
              triggerClassName="adopt-form-input"
              aria-label="Энергичность"
            />
            <small className="field-hint">Уровень активности питомца</small>
          </div>
        </div>

        <div className="adopt-form-row">
          <div className="adopt-form-group">
            <label htmlFor="post-pet-care">Необходимый уход</label>
            <StyledSelect
              id="post-pet-care"
              value={careLevel}
              onChange={setCareLevel}
              options={POST_PET_CARE_OPTIONS}
              triggerClassName="adopt-form-input"
              aria-label="Необходимый уход"
            />
            <small className="field-hint">Сложность ухода за питомцем</small>
          </div>

          <div className="adopt-form-group">
            <label htmlFor="post-pet-activity">Потребность в активности</label>
            <StyledSelect
              id="post-pet-activity"
              value={activityNeeds}
              onChange={setActivityNeeds}
              options={POST_PET_ACTIVITY_OPTIONS}
              triggerClassName="adopt-form-input"
              aria-label="Потребность в активности"
            />
          </div>
        </div>

        <div className="adopt-form-group">
          <label>Особенности характера</label>
          <div className="temperament-selector">
            <div className="temperament-buttons">
              {availableTemperaments.map(trait => (
                <button
                  key={trait}
                  type="button"
                  className={`temperament-btn ${temperamentTraits.includes(trait) ? 'active' : ''}`}
                  onClick={() => handleTemperamentToggle(trait)}
                >
                  {trait}
                </button>
              ))}
            </div>
            {!showNewTemperamentInput ? (
              <button
                type="button"
                className="add-temperament-btn"
                onClick={() => {
                  setShowNewTemperamentInput(true);
                  // Очищаем ошибку и поле при открытии
                  setTemperamentError('');
                  setNewTemperament('');
                }}
              >
                + Добавить новую черту характера
              </button>
            ) : (
              <div className="new-temperament-input">
                <input
                  type="text"
                  value={newTemperament}
                  onChange={(e) => {
                    setNewTemperament(e.target.value);
                    setTemperamentError(''); // Очищаем ошибку при вводе
                  }}
                  placeholder="Введите черту характера (например: умный)"
                  className="adopt-form-input"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddNewTemperament();
                    }
                  }}
                />
                {temperamentError && (
                  <div className="error-message" style={{ color: 'red', fontSize: '12px', marginTop: '5px' }}>
                    {temperamentError}
                  </div>
                )}
                <div className="temperament-input-actions">
                  <button
                    type="button"
                    className="save-temperament-btn"
                    onClick={handleAddNewTemperament}
                  >
                    Добавить
                  </button>
                  <button
                    type="button"
                    className="cancel-temperament-btn"
                    onClick={() => {
                      setShowNewTemperamentInput(false);
                      setTemperamentError('');
                      setNewTemperament("");
                    }}
                  >
                    Отмена
                  </button>
                </div>
                <small>Черта будет автоматически отформатирована как "умный(-ая)"</small>
              </div>
            )}
            {temperamentTraits.length > 0 && (
              <div className="selected-temperaments">
                <strong>Выбрано:</strong> {temperamentTraits.join(', ')}
              </div>
            )}
          </div>
        </div>

        <div className="adopt-form-group">
          <label>Дополнительные условия</label>
          <div className="checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isKidFriendly}
                onChange={(e) => setIsKidFriendly(e.target.checked)}
              />
              <span>Подходит для семьи с детьми</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isPetFriendly}
                onChange={(e) => setIsPetFriendly(e.target.checked)}
              />
              <span>Ладит с другими животными</span>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={hypoallergenic}
                onChange={(e) => setHypoallergenic(e.target.checked)}
              />
              <span>Гипоаллергенный</span>
            </label>
          </div>
        </div>

        <div className="adopt-form-group">
          <label>Медицинские заметки</label>
          <textarea
            value={medicalNotes}
            onChange={(e) => setMedicalNotes(e.target.value)}
            placeholder="Укажите информацию о здоровье, прививках, особых потребностях (необязательно)"
            rows="3"
            className="adopt-form-input"
          />
          <small className="field-hint">Эта информация поможет потенциальным хозяевам лучше понять потребности питомца</small>
        </div>
      </div>

      <div className="adopt-form-section">
        <h3>Причина размещения питомца</h3>
        <div className="adopt-form-group">
          <textarea
            rows="5"
            value={justification}
            onChange={handleJustificationChange}
            placeholder="Расскажите, почему питомец нуждается в новом доме. Например: переезд, аллергия, изменение жизненных обстоятельств..."
            className={`adopt-form-input ${validationErrors.justification ? 'input-error' : ''}`}
          />
          {validationErrors.justification && (
            <div className="error-message">{validationErrors.justification}</div>
          )}
        </div>
      </div>

      <div className="adopt-form-section">
        <h3>Контактная информация</h3>
        <div className="adopt-form-row">
          <div className="adopt-form-group">
            <label htmlFor="email-input">Email для связи</label>
            <input
              id="email-input"
              type="email"
              value={email}
              readOnly
              className="adopt-form-input readonly-field"
              title="Email из вашего профиля"
            />
            <small className="adopt-form-help-text">Используется email из вашего профиля</small>
          </div>

          <div className="adopt-form-group">
            <label>Номер телефона</label>
            <input
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="+375XXXXXXXXX"
              className={`adopt-form-input ${validationErrors.phone ? 'input-error' : ''}`}
            />
            {validationErrors.phone && (
              <div className="error-message">{validationErrors.phone}</div>
            )}
            <small className="field-hint">Формат: +375XXXXXXXXX</small>
          </div>
        </div>
      </div>

      {formError && (
        <div className="adopt-form-error-banner">
          <p>Пожалуйста, заполните все поля формы корректно.</p>
        </div>
      )}

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
    </div>
  );
};

export default PostPetSection;