import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuthContext } from '../../hooks/UseAuthContext';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import io from 'socket.io-client';
import axios from 'axios';
import { formatAge } from '../../utils/ageFormatter';
import { getSocketServerUrl } from '../../utils/socketServerUrl';
import { getPetImageUrl } from '../../utils/petImageUrl';
import { usePetFilters } from '../../hooks/usePetFilters';
import PetFilter from '../Pets/PetFilter';
import StyledSelect from '../UI/StyledSelect';
import './PetManagement.css';

const ADMIN_PET_SIZE_OPTIONS = [
  { value: 'small', label: 'Маленький' },
  { value: 'medium', label: 'Средний' },
  { value: 'large', label: 'Большой' }
];

const ADMIN_PET_ENERGY_OPTIONS = [
  { value: 'low', label: 'Низкий' },
  { value: 'medium', label: 'Средний' },
  { value: 'high', label: 'Высокий' }
];

const ADMIN_PET_CARE_OPTIONS = [
  { value: 'low', label: 'Низкий' },
  { value: 'medium', label: 'Средний' },
  { value: 'high', label: 'Высокий' }
];

const ADMIN_PET_ACTIVITY_OPTIONS = [
  { value: 'low', label: 'Низкие' },
  { value: 'moderate', label: 'Умеренные' },
  { value: 'high', label: 'Высокие' }
];

const PetManagement = () => {
  const { user, dispatch } = useAuthContext();
  const [pets, setPets] = useState([]);
  const [shelters, setShelters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedPet, setSelectedPet] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    birthDate: '',
    species: '',
    breed: '',
    description: '',
    shelter_id: '',
    area: '',
    email: '',
    phone: '',
    status: 'Pending',
    // Новые поля из фильтров
    size: 'medium',
    energyLevel: 'medium',
    careLevel: 'medium',
    activityNeeds: 'moderate',
    temperamentTraits: [],
    isKidFriendly: true,
    isPetFriendly: true,
    hypoallergenic: false,
    medicalNotes: ''
  });

  // Состояния для кастомного вида и породы
  const [isOtherSpecies, setIsOtherSpecies] = useState(false);
  const [isOtherBreed, setIsOtherBreed] = useState(false);
  const [customSpecies, setCustomSpecies] = useState('');
  const [customBreed, setCustomBreed] = useState('');
  const [availableBreeds, setAvailableBreeds] = useState([]);
  const [availableSpecies, setAvailableSpecies] = useState([]);
  
  // Состояния для темперамента
  const [availableTemperaments, setAvailableTemperaments] = useState([]);
  const [customTemperament, setCustomTemperament] = useState('');
  const [showCustomTemperament, setShowCustomTemperament] = useState(false);
  const [temperamentError, setTemperamentError] = useState('');

  // Фильтрация питомцев
  const { filters, handleFilterChange, filterPets } = usePetFilters();
  
  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState('');
  
  // File upload state
  const [picture, setPicture] = useState(null);
  const [fileName, setFileName] = useState('');

  // Socket reference
  const socketRef = useRef();
  
  // Ref для отслеживания инициализации формы редактирования
  const isInitializingEditForm = useRef(false);
  
  // Field-level validation errors
  const [fieldErrors, setFieldErrors] = useState({});

  const speciesFormOptions = useMemo(
    () => [
      { value: '', label: 'Выберите вид' },
      ...availableSpecies.map((s) => ({ value: s, label: s })),
      { value: 'Другое', label: 'Другое' }
    ],
    [availableSpecies]
  );

  const breedFormOptions = useMemo(
    () => [
      { value: '', label: 'Выберите породу' },
      ...(formData.species ? availableBreeds.map((b) => ({ value: b, label: b })) : []),
      { value: 'Другое', label: 'Другое' }
    ],
    [formData.species, availableBreeds]
  );

  const shelterFormOptions = useMemo(
    () => [
      { value: '', label: 'Выберите приют' },
      ...shelters.map((sh) => ({
        value: String(sh._id),
        label: `${sh.name} (${sh.current_capacity}/${sh.max_capacity})`
      }))
    ],
    [shelters]
  );

  // Initialize socket connection
  useEffect(() => {
    if (!user) return;
    
    // Connect to socket server
    const socket = io(getSocketServerUrl(), {
      path: '/socket.io',
      auth: {
        token: user.token
      }
    });
    
    socketRef.current = socket;
    
    // Join rooms for updates
    socket.emit('joinRoom', 'pets');
    socket.emit('joinRoom', 'shelters');
    
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
    
    // Listen for pet updates
    socket.on('petRequestUpdate', (updatedPet) => {
      setPets(prevPets => {
        const petIndex = prevPets.findIndex(pet => pet._id === updatedPet._id);
        
        if (petIndex >= 0) {
          // Update existing pet
          const updatedPets = [...prevPets];
          updatedPets[petIndex] = updatedPet;
          return updatedPets;
        } else {
          // Add new pet
          setSuccess(`Новый питомец ${updatedPet.name} добавлен в систему`);
          setTimeout(() => setSuccess(null), 3000);
          return [...prevPets, updatedPet];
        }
      });
    });

    // Listen for new pets
    socket.on('newPet', (newPet) => {
      setPets(prevPets => {
        // Check if this pet already exists in the list
        if (prevPets.some(pet => pet._id === newPet._id)) {
          return prevPets;
        }
        
        setSuccess(`Новый питомец ${newPet.name} добавлен в систему`);
        setTimeout(() => setSuccess(null), 3000);
        return [...prevPets, newPet];
      });
    });
    
    // Listen for pet deletions
    socket.on('petDeleted', ({ id }) => {
      setPets(prevPets => prevPets.filter(pet => pet._id !== id));
      setSuccess('Питомец был удален из системы');
      setTimeout(() => setSuccess(null), 3000);
    });
    
    // Listen for shelter updates
    socket.on('shelterUpdate', (updatedShelter) => {
      setShelters(prevShelters => {
        return prevShelters.map(shelter => 
          shelter._id === updatedShelter._id ? updatedShelter : shelter
        );
      });
    });

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
      if (newBreed && formData.species === newSpecies) {
        setAvailableBreeds(prevBreeds => {
          if (!prevBreeds.includes(newBreed)) {
            return [...prevBreeds, newBreed].sort();
          }
          return prevBreeds;
        });
      }
    });

    // Слушаем обновления темперамента
    socket.on('temperamentUpdate', (data) => {
      console.log('Получено обновление темперамента:', data);
      
      // Извлекаем строку темперамента из объекта или используем как есть
      const newTemperament = typeof data === 'string' ? data : data.temperament;
      
      if (newTemperament && typeof newTemperament === 'string') {
        setAvailableTemperaments(prevTemperaments => {
          if (!prevTemperaments.includes(newTemperament)) {
            return [...prevTemperaments, newTemperament].sort();
          }
          return prevTemperaments;
        });
      }
    });

    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [user, formData.species, dispatch]);

  // Прокручиваем modal-content в начало при открытии
  useEffect(() => {
    if (showAddForm || showEditForm) {
      setTimeout(() => {
        const modalContent = document.querySelector('.shelter-form-modal .modal-content');
        if (modalContent) {
          modalContent.scrollTop = 0;
          modalContent.scrollTo({ top: 0, behavior: 'auto' });
        }
      }, 50);
    }
  }, [showAddForm, showEditForm]);
  
  // Fetch all pets and shelters
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch pets and shelters in parallel
        const [petsRes, sheltersRes] = await Promise.all([
          fetch('/api/admin-pets/allPets', {
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
        
        if (!petsRes.ok || !sheltersRes.ok) {
          throw new Error('Не удалось загрузить данные');
        }
        
        const petsData = await petsRes.json();
        const sheltersData = await sheltersRes.json();
        
        setPets(petsData);
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
  
  // Обогащаем данные животных информацией о городе приюта для фильтрации
  const petsWithShelterInfo = pets.map(pet => {
    const shelter = shelters.find(s => s._id === pet.shelter_id);
    return {
      ...pet,
      shelterCity: shelter ? shelter.city : null
    };
  });

  // Применяем фильтры к питомцам
  const filteredPets = filterPets(petsWithShelterInfo);

  // Загрузка видов животных и темперамента
  useEffect(() => {
    const fetchSpeciesAndTemperaments = async () => {
      if (!user || !user.token) return;
      
      try {
        const [speciesRes, temperamentsRes] = await Promise.all([
          fetch('/api/admin-pets/species', {
            headers: { 'Authorization': `Bearer ${user.token}` }
          }),
          fetch('/api/pets/temperaments', {
            headers: { 'Authorization': `Bearer ${user.token}` }
          })
        ]);
        
        if (speciesRes.ok) {
          const speciesList = await speciesRes.json();
          setAvailableSpecies(speciesList);
        }
        
        if (temperamentsRes.ok) {
          const temperamentsList = await temperamentsRes.json();
          setAvailableTemperaments(temperamentsList);
        }
      } catch (error) {
        console.error("Ошибка при загрузке данных:", error);
      }
    };
    
    fetchSpeciesAndTemperaments();
  }, [user]);
  
  // Получаем породы при изменении типа животного
  useEffect(() => {
    const fetchBreeds = async () => {
      if (!formData.species || !user || !user.token) return;
      
      try {
        const response = await fetch(`/api/admin-pets/breeds/${formData.species}`, {
          headers: {
            'Authorization': `Bearer ${user.token}`
          }
        });
        
        if (response.ok) {
          const breeds = await response.json();
          setAvailableBreeds(breeds);
          
          // Проверяем, является ли текущая порода кастомной (не входит в список доступных)
          if (formData.breed && !breeds.includes(formData.breed)) {
            // Порода не найдена в списке - это кастомная порода
            setIsOtherBreed(true);
            setCustomBreed(formData.breed);
          } else if (formData.breed && breeds.includes(formData.breed)) {
            // Порода найдена в списке - это стандартная порода
            setIsOtherBreed(false);
            setCustomBreed('');
          } else if (!isInitializingEditForm.current && !showEditForm) {
            // Сбрасываем породу только если мы не инициализируем форму редактирования
            // и не находимся в режиме редактирования
            setIsOtherBreed(false);
            setCustomBreed('');
          }
        }
      } catch (error) {
        console.error("Ошибка при загрузке пород:", error);
      }
    };
    
    if (formData.species && formData.species !== 'Другое') {
      fetchBreeds();
      
      // Сбрасываем выбранную породу только при изменении вида в форме добавления
      // При редактировании не сбрасываем породу
      if (!isInitializingEditForm.current && !showEditForm && !selectedPet && formData.breed) {
        setFormData(prev => ({...prev, breed: ''}));
        setCustomBreed('');
        setIsOtherBreed(false);
      }
    }
    
    // Сбрасываем флаг инициализации после завершения
    if (isInitializingEditForm.current) {
      isInitializingEditForm.current = false;
    }
  }, [formData.species, user, showEditForm, selectedPet]);
  
  // Валидация всех полей формы
  const validateForm = () => {
    const errors = {};
    
    // Валидация клички
    if (!formData.name.trim()) {
      errors.name = 'Кличка питомца обязательна';
    } else if (formData.name.length < 2) {
      errors.name = 'Кличка должна содержать минимум 2 символа';
    }
    
    // Валидация даты рождения
    if (!formData.birthDate) {
      errors.birthDate = 'Дата рождения обязательна';
    } else {
      const birthDate = new Date(formData.birthDate);
      const now = new Date();
      if (birthDate > now) {
        errors.birthDate = 'Дата рождения не может быть в будущем';
      }
    }
    
    // Валидация вида
    if (!formData.species.trim()) {
      errors.species = 'Вид животного обязателен';
    }
    
    // Валидация породы
    if (!formData.breed.trim()) {
      errors.breed = 'Порода обязательна';
    }
    
    // Валидация приюта
    if (!formData.shelter_id) {
      errors.shelter_id = 'Выбор приюта обязателен';
    }
    
    // Валидация описания
    if (!formData.description.trim()) {
      errors.description = 'Описание обязательно';
    } else if (formData.description.length < 20) {
      errors.description = 'Описание должно содержать минимум 20 символов';
    }
    
    // Валидация email, если указан
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Введите корректный email адрес';
    }
    
    // Валидация телефона, если указан
    if (formData.phone) {
      const phonePattern = /^\+375[0-9]{9}$/;
      if (!phonePattern.test(formData.phone)) {
        errors.phone = 'Введите корректный номер телефона в формате +375XXXXXXXXX';
      }
    }
    
    // Валидация размера
    if (!formData.size) {
      errors.size = 'Выберите размер питомца';
    }
    
    // Валидация уровня энергии
    if (!formData.energyLevel) {
      errors.energyLevel = 'Выберите уровень энергии';
    }
    
    // Валидация уровня ухода
    if (!formData.careLevel) {
      errors.careLevel = 'Выберите уровень ухода';
    }
    
    // Валидация потребностей в активности
    if (!formData.activityNeeds) {
      errors.activityNeeds = 'Выберите потребности в активности';
    }
    
    return errors;
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Если пользователь изменяет поле, очищаем ошибку для этого поля
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
    
    if (name === 'species') {
      if (value === 'Другое') {
        setIsOtherSpecies(true);
        setFormData({ ...formData, [name]: customSpecies || '' });
      } else {
        setIsOtherSpecies(false);
        setFormData({ ...formData, [name]: value });
      }
    } else if (name === 'breed') {
      if (value === 'Другое') {
        setIsOtherBreed(true);
        setFormData({ ...formData, [name]: customBreed || '' });
      } else {
        setIsOtherBreed(false);
        setFormData({ ...formData, [name]: value });
      }
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handleSelectField = (name) => (value) => {
    handleInputChange({ target: { name, value } });
  };

  // Handle file input change
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setPicture(selectedFile);
      setFileName(selectedFile.name);
    }
  };
  
  // Reset form data
  const resetForm = () => {
    setFormData({
      name: '',
      birthDate: '',
      species: '',
      breed: '',
      description: '',
      shelter_id: '',
      area: '',
      email: '',
      phone: '',
      status: 'Pending',
      size: 'medium',
      energyLevel: 'medium',
      careLevel: 'medium',
      activityNeeds: 'moderate',
      temperamentTraits: [],
      isKidFriendly: true,
      isPetFriendly: true,
      hypoallergenic: false,
      medicalNotes: ''
    });
    setPicture(null);
    setFileName('');
    setIsOtherSpecies(false);
    setIsOtherBreed(false);
    setCustomSpecies('');
    setCustomBreed('');
    setCustomTemperament('');
    setShowCustomTemperament(false);
    setFieldErrors({});
  };
  
  // Open add pet form
  const handleAddPet = () => {
    resetForm();
    setShowAddForm(true);
  };
  
  // Open edit pet form
  const handleEditPet = (pet) => {
    // Устанавливаем флаг инициализации формы редактирования
    isInitializingEditForm.current = true;
    
    setSelectedPet(pet);
    
    // Устанавливаем данные питомца
    const petData = {
      ...pet,
      birthDate: pet.birthDate ? pet.birthDate.split('T')[0] : ''
    };
    
    setFormData(petData);
    
    // Проверяем, является ли вид кастомным
    if (pet.species === 'Другое' || !availableSpecies.includes(pet.species)) {
      setIsOtherSpecies(true);
      setCustomSpecies(pet.species);
    } else {
      setIsOtherSpecies(false);
      setCustomSpecies('');
    }
    
    // Запрашиваем породы для выбранного вида животного
    const fetchBreeds = async () => {
      if (!pet.species || !user || !user.token) return;
      
      try {
        const response = await fetch(`/api/admin-pets/breeds/${pet.species}`, {
          headers: {
            'Authorization': `Bearer ${user.token}`
          }
        });
        
        if (response.ok) {
          const breeds = await response.json();
          setAvailableBreeds(breeds);
          
          // Проверяем, является ли порода кастомной (не входит в список доступных)
          if (pet.breed && !breeds.includes(pet.breed)) {
            // Порода не найдена в списке - это кастомная порода
            setIsOtherBreed(true);
            setCustomBreed(pet.breed);
          } else if (pet.breed && breeds.includes(pet.breed)) {
            // Порода найдена в списке - это стандартная порода
            setIsOtherBreed(false);
            setCustomBreed('');
          } else {
            // Породы нет
            setIsOtherBreed(false);
            setCustomBreed('');
          }
        }
      } catch (error) {
        console.error("Ошибка при загрузке пород:", error);
      }
    };
    
    fetchBreeds();
    setShowEditForm(true);
  };
  
  // Show confirmation dialog
  const showConfirm = (message, action) => {
    setConfirmMessage(message);
    setConfirmAction(() => action);
    setShowConfirmDialog(true);
  };
  
  // Handle confirmation dialog response
  const handleConfirm = () => {
    if (confirmAction) {
      confirmAction();
    }
    setShowConfirmDialog(false);
  };
  
  // Handle delete pet
  const handleDeletePet = (pet) => {
    // Предупреждение в зависимости от статуса питомца
    let warningMessage;
    
    if (pet.status === 'Approved' || pet.status === 'InReview') {
      warningMessage = `Вы уверены, что хотите удалить питомца "${pet.name}"? 

ВНИМАНИЕ: Этот питомец имеет статус "${getStatusText(pet.status)}" и может иметь активные заявки на усыновление. 

При удалении питомца:
• Все связанные заявки будут автоматически удалены
• Заявители получат уведомления об отмене по email
• Вместимость приюта будет обновлена

Это действие нельзя отменить.`;
    } else if (pet.status === 'Adopted') {
      warningMessage = `Вы уверены, что хотите удалить питомца "${pet.name}"? 

ИНФОРМАЦИЯ: Этот питомец уже усыновлен. Удаление записи не повлияет на усыновление, но удалит информацию из системы.

Это действие нельзя отменить.`;
    } else {
      warningMessage = `Вы уверены, что хотите удалить питомца "${pet.name}"? 

Это действие нельзя отменить.`;
    }
    
    showConfirm(
      warningMessage,
      async () => {
        try {
          // Добавляем временное сообщение о процессе удаления
          setSuccess(`Удаление питомца "${pet.name}"...`);
          
          const response = await fetch(`/api/admin-pets/delete/${pet._id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${user.token}`
            }
          });
          
          if (!response.ok) {
            throw new Error(`Сервер вернул ошибку: ${response.status}`);
          }
          
          // Удаляем питомца из локального состояния
          setPets(prevPets => prevPets.filter(p => p._id !== pet._id));
          
          // Показываем сообщение об успешном удалении
          setSuccess(`Питомец "${pet.name}" успешно удален`);
          setTimeout(() => setSuccess(null), 3000);
          
        } catch (err) {
          console.error('Ошибка при удалении питомца:', err);
          setError(`Не удалось удалить питомца: ${err.message}. Попробуйте перезагрузить страницу.`);
          setTimeout(() => setError(null), 5000);
        }
      }
    );
  };
  
  // Submit handler for add/edit forms
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Валидация полей формы
    const validationErrors = validateForm();
    
    // Если есть ошибки валидации, показываем и прекращаем отправку
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setError('Пожалуйста, исправьте ошибки в форме');
      setTimeout(() => setError(null), 5000);
      return;
    }
    
    // Сбрасываем ошибки валидации
    setFieldErrors({});
    
    try {
      const petFormData = new FormData();
      
      // Append form data fields
      Object.keys(formData).forEach(key => {
        const value = formData[key];
        
        // Пропускаем пустые значения (кроме специальных случаев)
        if (value === null || value === undefined) {
          return;
        }
        
        // Специальная обработка для массивов (особенно temperamentTraits)
        if (key === 'temperamentTraits' && Array.isArray(value)) {
          // Добавляем каждый элемент массива отдельно с синтаксисом []
          // Если массив пустой, не добавляем ничего
          value.forEach(trait => {
            if (trait) {
              petFormData.append('temperamentTraits[]', trait);
            }
          });
        } else if (Array.isArray(value)) {
          // Для других массивов также добавляем каждый элемент отдельно
          value.forEach(item => {
            if (item !== null && item !== undefined) {
              petFormData.append(`${key}[]`, item);
            }
          });
        } else if (typeof value === 'boolean') {
          // Для булевых значений преобразуем в строку (сервер должен правильно обработать)
          petFormData.append(key, value.toString());
        } else {
          // Для обычных значений добавляем как есть
          petFormData.append(key, value);
        }
      });
      
      // Append picture if available
      if (picture) {
        petFormData.append('picture', picture);
      }
      
      let response;
      
      if (showEditForm && selectedPet) {
        // Update existing pet
        response = await fetch(`/api/admin-pets/updatePet/${selectedPet._id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${user.token}`
          },
          body: petFormData
        });
      } else {
        // Create new pet
        response = await fetch('/api/admin-pets/services', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${user.token}`
          },
          body: petFormData
        });
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Не удалось ${showEditForm ? 'обновить' : 'создать'} питомца`);
      }
      
      const responseData = await response.json();
      
      // Обновляем список приютов после изменений для отображения актуальной информации по capacity
      try {
        const sheltersResponse = await fetch('/api/shelters', {
          headers: { 
            'Authorization': `Bearer ${user.token}` 
          }
        });
        
        if (sheltersResponse.ok) {
          const updatedShelters = await sheltersResponse.json();
          setShelters(updatedShelters);
        }
      } catch (error) {
        console.error('Ошибка при обновлении списка приютов:', error);
      }
      
      // Update local state (socket will also handle this)
      if (showEditForm) {
        setPets(pets.map(pet => 
          pet._id === selectedPet._id ? responseData : pet
        ));
        setSuccess(`Питомец "${responseData.name}" успешно обновлен`);
      } else {
        setPets([...pets, responseData]);
        setSuccess(`Питомец "${responseData.name}" успешно создан`);
      }
      
      // Reset and close forms
      resetForm();
      
      // Explicitly close the forms
      setShowAddForm(false);
      setShowEditForm(false);
      
      // Reset form state completely
      setFormData({
        name: '',
        birthDate: '',
        species: '',
        breed: '',
        description: '',
        shelter_id: '',
        area: '',
        email: '',
        phone: '',
        status: 'Pending'
      });
      setPicture(null);
      setFileName('');
      setIsOtherSpecies(false);
      setIsOtherBreed(false);
      setCustomSpecies('');
      setCustomBreed('');
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error(`Ошибка при ${showEditForm ? 'обновлении' : 'создании'} питомца:`, err);
      setError(`Не удалось ${showEditForm ? 'обновить' : 'создать'} питомца: ${err.message}`);
      setTimeout(() => setError(null), 5000);
    }
  };

  // Format time ago
  const formatTimeAgo = (date) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ru });
  };

  // Status badge class
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Pending': return 'status-badge status-pending';
      case 'InReview': return 'status-badge status-review';
      case 'Approved': return 'status-badge status-approved';
      case 'Adopted': return 'status-badge status-adopted';
      case 'Rejected': return 'status-badge status-rejected';
      default: return 'status-badge';
    }
  };

  // Status text
  const getStatusText = (status) => {
    switch (status) {
      case 'Pending': return 'На рассмотрении';
      case 'InReview': return 'В процессе';
      case 'Approved': return 'Одобрен';
      case 'Adopted': return 'Усыновлен';
      case 'Rejected': return 'Отклонен';
      default: return status;
    }
  };

  // Handle custom input changes for species and breeds
  const handleCustomInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'customSpecies') {
      setCustomSpecies(value);
      setFormData(prev => ({ ...prev, species: value }));
    } else if (name === 'customBreed') {
      setCustomBreed(value);
      setFormData(prev => ({ ...prev, breed: value }));
    } else if (name === 'customTemperament') {
      setCustomTemperament(value);
      // Очищаем ошибку при вводе текста
      if (temperamentError) {
        setTemperamentError('');
      }
    }
  };

  // Обработчик изменения темперамента
  const handleTemperamentChange = (trait) => {
    setFormData(prev => {
      const currentTraits = prev.temperamentTraits || [];
      // Предотвращаем дубликаты
      if (currentTraits.includes(trait)) {
        return {
          ...prev,
          temperamentTraits: currentTraits.filter(t => t !== trait)
        };
      } else {
        return {
          ...prev,
          temperamentTraits: [...currentTraits, trait]
        };
      }
    });
  };

  // Добавление кастомного темперамента
  const handleAddCustomTemperament = () => {
    const trimmedTrait = customTemperament.trim();
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
    
    // Форматируем темперамент в гендерно-нейтральный формат
    let formattedTrait;
    if (trimmedTrait.includes('(-')) {
      formattedTrait = trimmedTrait;
    } else if (baseTrait.endsWith('ая')) {
      const base = baseTrait.slice(0, -2);
      formattedTrait = `${base}ый(-ая)`;
    } else if (baseTrait.endsWith('яя')) {
      const base = baseTrait.slice(0, -2);
      formattedTrait = `${base}ий(-ая)`;
    } else {
      formattedTrait = `${trimmedTrait}(-ая)`;
    }
    
    // Проверяем на дубликаты в выбранных характеристиках
    const currentTraits = formData.temperamentTraits || [];
    if (currentTraits.includes(formattedTrait)) {
      setTemperamentError('Эта характеристика уже добавлена');
      return;
    }
    
    // Добавляем в availableTemperaments
    if (!availableTemperaments.includes(formattedTrait)) {
      setAvailableTemperaments(prev => [...prev, formattedTrait].sort());
    }
    
    // Добавляем в выбранные темпераменты
    setFormData(prev => ({
      ...prev,
      temperamentTraits: [...currentTraits, formattedTrait]
    }));
    
    setCustomTemperament('');
    setShowCustomTemperament(false);
    setTemperamentError('');
  };

  // Отображаемый текст статуса
  const getStatusLabel = (status) => {
    switch (status) {
      case 'Pending': return 'На рассмотрении';
      case 'InReview': return 'В процессе';
      case 'Approved': return 'Одобрен';
      case 'Rejected': return 'Отклонен';
      default: return status;
    }
  };

  return (
    <div className="pet-management-container">
      <div className="shelter-management-header">
        <h1>Управление животными</h1>
        <p>Создание, редактирование и удаление питомцев в системе</p>
        <button className="add-pet-btn" onClick={handleAddPet}>
          Добавить нового питомца
        </button>
      </div>
      
      {/* Фильтры питомцев */}
      <PetFilter
        pets={pets}
        shelters={shelters}
        filters={filters}
        onFilterChange={handleFilterChange}
      />
      
      {/* Notifications */}
      {error && (
        <div className="notification-banner">
          <div className="notification-content" style={{ backgroundColor: '#f44336' }}>
            {error}
            <button className="notification-close" onClick={() => setError(null)}>×</button>
          </div>
        </div>
      )}
      
      {success && (
        <div className="notification-banner">
          <div className="notification-content" style={{ backgroundColor: '#4caf50' }}>
            {success}
            <button className="notification-close" onClick={() => setSuccess(null)}>×</button>
          </div>
        </div>
      )}
      
      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="modal-overlay">
          <div className="modal confirmation-modal">
            <div className="modal-header">
              <h2>Подтверждение</h2>
            </div>
            <div className="modal-content">
              <p>{confirmMessage}</p>
              <div className="confirmation-actions">
                <button 
                  className="cancel-btn" 
                  onClick={() => setShowConfirmDialog(false)}
                >
                  Отмена
                </button>
                <button 
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
      
      {/* Add Pet Form */}
      {showAddForm && (
        <div className="modal-overlay">
          <div className="modal shelter-form-modal">
            <div className="modal-header">
              <h2>Добавить нового питомца</h2>
              <button className="close-modal" onClick={() => setShowAddForm(false)}>×</button>
            </div>
            <div className="modal-content">
              <form onSubmit={handleSubmit} className="shelter-form">
                <div className="form-section">
                  <h4 className="form-section-title">Основная информация</h4>
                
                  <div className="form-row">
                    <div className="form-group">
                      <label>Кличка питомца</label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="Введите кличку питомца"
                        className={fieldErrors.name ? "input-error" : formData.name ? "field-valid" : ""}
                        required
                      />
                      {fieldErrors.name && (
                        <div className="field-error-message">{fieldErrors.name}</div>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label>Дата рождения</label>
                      <input
                        type="date"
                        name="birthDate"
                        value={formData.birthDate}
                        onChange={handleInputChange}
                        max={new Date().toISOString().split('T')[0]}
                        className={fieldErrors.birthDate ? "input-error" : formData.birthDate ? "field-valid" : ""}
                        required
                      />
                      {fieldErrors.birthDate && (
                        <div className="field-error-message">{fieldErrors.birthDate}</div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="form-section">
                  <h4 className="form-section-title">Вид и порода</h4>
                
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="admin-pet-species">Вид животного</label>
                      <StyledSelect
                        id="admin-pet-species"
                        value={isOtherSpecies ? 'Другое' : formData.species}
                        onChange={handleSelectField('species')}
                        options={speciesFormOptions}
                        required
                        triggerClassName={
                          fieldErrors.species ? 'input-error' : formData.species ? 'field-valid' : ''
                        }
                        aria-label="Вид животного"
                      />
                      {isOtherSpecies && (
                        <input
                          type="text"
                          name="customSpecies"
                          value={customSpecies}
                          onChange={handleCustomInputChange}
                          placeholder="Введите вид животного"
                          className={`mt-2 ${fieldErrors.species ? "input-error" : customSpecies ? "field-valid" : ""}`}
                          required
                        />
                      )}
                      {fieldErrors.species && (
                        <div className="field-error-message">{fieldErrors.species}</div>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="admin-pet-breed">Порода</label>
                      <StyledSelect
                        id="admin-pet-breed"
                        value={isOtherBreed ? 'Другое' : formData.breed}
                        onChange={handleSelectField('breed')}
                        options={breedFormOptions}
                        required
                        triggerClassName={
                          fieldErrors.breed ? 'input-error' : formData.breed ? 'field-valid' : ''
                        }
                        aria-label="Порода"
                      />
                      {isOtherBreed && (
                        <input
                          type="text"
                          name="customBreed"
                          value={customBreed}
                          onChange={handleCustomInputChange}
                          placeholder="Введите породу"
                          className={`mt-2 ${fieldErrors.breed ? "input-error" : customBreed ? "field-valid" : ""}`}
                          required
                        />
                      )}
                      {fieldErrors.breed && (
                        <div className="field-error-message">{fieldErrors.breed}</div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="form-section">
                  <h4 className="form-section-title">Местоположение и контакты</h4>
                
                  <div className="form-row">
                    <div className="form-group">
                      <label>Местоположение</label>
                      <input
                        type="text"
                        name="area"
                        value={formData.area}
                        onChange={handleInputChange}
                        placeholder="Город, район"
                        className={fieldErrors.area ? "input-error" : ""}
                      />
                      {fieldErrors.area && (
                        <div className="field-error-message">{fieldErrors.area}</div>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="admin-pet-shelter">Приют</label>
                      <StyledSelect
                        id="admin-pet-shelter"
                        value={
                          formData.shelter_id != null && formData.shelter_id !== ''
                            ? String(formData.shelter_id)
                            : ''
                        }
                        onChange={handleSelectField('shelter_id')}
                        options={shelterFormOptions}
                        required
                        triggerClassName={
                          fieldErrors.shelter_id ? 'input-error' : formData.shelter_id ? 'field-valid' : ''
                        }
                        aria-label="Приют"
                      />
                      {fieldErrors.shelter_id && (
                        <div className="field-error-message">{fieldErrors.shelter_id}</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label>Email для контакта</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="Контактный email"
                        className={fieldErrors.email ? "input-error" : formData.email ? "field-valid" : ""}
                      />
                      {fieldErrors.email && (
                        <div className="field-error-message">{fieldErrors.email}</div>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label>Телефон для контакта</label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="Формат: +375XXXXXXXXX"
                        className={fieldErrors.phone ? "input-error" : formData.phone ? "field-valid" : ""}
                      />
                      {fieldErrors.phone && (
                        <div className="field-error-message">{fieldErrors.phone}</div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="form-section">
                  <h4 className="form-section-title">Описание и фото</h4>
                
                  <div className="form-group">
                    <label>Описание</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Подробное описание питомца (минимум 20 символов)"
                      rows="4"
                      className={fieldErrors.description ? "input-error" : formData.description.length >= 20 ? "field-valid" : ""}
                      required
                    ></textarea>
                    {fieldErrors.description && (
                      <div className="field-error-message">{fieldErrors.description}</div>
                    )}
                    <div className="char-counter">
                      {formData.description.length}/20 символов минимум
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label>Фотография питомца</label>
                    <div className="adopt-form-file-input">
                      <input
                        type="file"
                        id="pet-photo"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="file-input"
                      />
                      <label htmlFor="pet-photo" className="adopt-form-file-label">
                        {fileName ? fileName : "Выберите фотографию питомца"}
                      </label>
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h4 className="form-section-title">Характеристики питомца</h4>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="admin-pet-size">Размер</label>
                      <StyledSelect
                        id="admin-pet-size"
                        value={formData.size}
                        onChange={handleSelectField('size')}
                        options={ADMIN_PET_SIZE_OPTIONS}
                        triggerClassName={fieldErrors.size ? 'input-error' : 'field-valid'}
                        aria-label="Размер"
                      />
                      {fieldErrors.size && (
                        <div className="field-error-message">{fieldErrors.size}</div>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="admin-pet-energy">Уровень энергии</label>
                      <StyledSelect
                        id="admin-pet-energy"
                        value={formData.energyLevel}
                        onChange={handleSelectField('energyLevel')}
                        options={ADMIN_PET_ENERGY_OPTIONS}
                        triggerClassName={fieldErrors.energyLevel ? 'input-error' : 'field-valid'}
                        aria-label="Уровень энергии"
                      />
                      {fieldErrors.energyLevel && (
                        <div className="field-error-message">{fieldErrors.energyLevel}</div>
                      )}
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="admin-pet-care">Уровень ухода</label>
                      <StyledSelect
                        id="admin-pet-care"
                        value={formData.careLevel}
                        onChange={handleSelectField('careLevel')}
                        options={ADMIN_PET_CARE_OPTIONS}
                        triggerClassName={fieldErrors.careLevel ? 'input-error' : 'field-valid'}
                        aria-label="Уровень ухода"
                      />
                      {fieldErrors.careLevel && (
                        <div className="field-error-message">{fieldErrors.careLevel}</div>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="admin-pet-activity">Потребности в активности</label>
                      <StyledSelect
                        id="admin-pet-activity"
                        value={formData.activityNeeds}
                        onChange={handleSelectField('activityNeeds')}
                        options={ADMIN_PET_ACTIVITY_OPTIONS}
                        triggerClassName={fieldErrors.activityNeeds ? 'input-error' : 'field-valid'}
                        aria-label="Потребности в активности"
                      />
                      {fieldErrors.activityNeeds && (
                        <div className="field-error-message">{fieldErrors.activityNeeds}</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h4 className="form-section-title">Темперамент</h4>
                  
                  <div className="form-group">
                    <label>Черты характера</label>
                    <div className="trait-buttons">
                      {availableTemperaments.map((trait) => (
                        <button
                          key={trait}
                          type="button"
                          className={`trait-button ${(formData.temperamentTraits || []).includes(trait) ? 'selected' : ''}`}
                          onClick={() => handleTemperamentChange(trait)}
                        >
                          {trait}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="trait-button add-trait"
                        onClick={() => {
                          const newState = !showCustomTemperament;
                          setShowCustomTemperament(newState);
                          // Очищаем ошибку и поле при открытии
                          if (newState) {
                            setTemperamentError('');
                            setCustomTemperament('');
                          }
                        }}
                      >
                        + Добавить свою
                      </button>
                    </div>
                    
                    {showCustomTemperament && (
                      <div className="custom-trait-input-wrapper">
                        <div className="custom-trait-input">
                          <input
                            type="text"
                            name="customTemperament"
                            value={customTemperament}
                            onChange={handleCustomInputChange}
                            placeholder="Например: дружелюбный"
                            className={`adopt-form-input ${temperamentError ? 'input-error' : ''}`}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddCustomTemperament();
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="add-trait-btn"
                            onClick={handleAddCustomTemperament}
                          >
                            Добавить
                          </button>
                        </div>
                        {temperamentError && (
                          <div className="temperament-error-message">
                            {temperamentError}
                          </div>
                        )}
                        <small className="temperament-hint">Черта будет автоматически отформатирована как "дружелюбный(-ая)"</small>
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-section">
                  <h4 className="form-section-title">Совместимость и здоровье</h4>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          name="isKidFriendly"
                          checked={formData.isKidFriendly}
                          onChange={(e) => setFormData({...formData, isKidFriendly: e.target.checked})}
                        />
                        <span>Подходит для детей</span>
                      </label>
                    </div>
                    
                    <div className="form-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          name="isPetFriendly"
                          checked={formData.isPetFriendly}
                          onChange={(e) => setFormData({...formData, isPetFriendly: e.target.checked})}
                        />
                        <span>Подходит для других животных</span>
                      </label>
                    </div>
                    
                    <div className="form-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          name="hypoallergenic"
                          checked={formData.hypoallergenic}
                          onChange={(e) => setFormData({...formData, hypoallergenic: e.target.checked})}
                        />
                        <span>Гипоаллергенный</span>
                      </label>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Медицинские заметки</label>
                    <textarea
                      name="medicalNotes"
                      value={formData.medicalNotes}
                      onChange={handleInputChange}
                      placeholder="Информация о здоровье, прививках, особых потребностях"
                      rows="3"
                      className="adopt-form-input"
                    ></textarea>
                  </div>
                </div>
                
                <div className="form-actions">
                  <button type="button" className="cancel-btn" onClick={() => setShowAddForm(false)}>
                    Отмена
                  </button>
                  <button type="submit" className="submit-btn">
                    Добавить питомца
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit Pet Form */}
      {showEditForm && selectedPet && (
        <div className="modal-overlay">
          <div className="modal shelter-form-modal">
            <div className="modal-header">
              <h2>Редактировать питомца</h2>
              <button className="close-modal" onClick={() => setShowEditForm(false)}>×</button>
            </div>
            <div className="modal-content">
              <form onSubmit={handleSubmit} className="shelter-form">
                <div className="form-section">
                  <h4 className="form-section-title">Основная информация</h4>
                
                  <div className="form-row">
                    <div className="form-group">
                      <label>Кличка питомца</label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="Введите кличку питомца"
                        className={fieldErrors.name ? "input-error" : formData.name ? "field-valid" : ""}
                        required
                      />
                      {fieldErrors.name && (
                        <div className="field-error-message">{fieldErrors.name}</div>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label>Дата рождения</label>
                      <input
                        type="date"
                        name="birthDate"
                        value={formData.birthDate}
                        onChange={handleInputChange}
                        max={new Date().toISOString().split('T')[0]}
                        className={fieldErrors.birthDate ? "input-error" : formData.birthDate ? "field-valid" : ""}
                        required
                      />
                      {fieldErrors.birthDate && (
                        <div className="field-error-message">{fieldErrors.birthDate}</div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="form-section">
                  <h4 className="form-section-title">Вид и порода</h4>
                
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="admin-pet-species">Вид животного</label>
                      <StyledSelect
                        id="admin-pet-species"
                        value={isOtherSpecies ? 'Другое' : formData.species}
                        onChange={handleSelectField('species')}
                        options={speciesFormOptions}
                        required
                        triggerClassName={
                          fieldErrors.species ? 'input-error' : formData.species ? 'field-valid' : ''
                        }
                        aria-label="Вид животного"
                      />
                      {isOtherSpecies && (
                        <input
                          type="text"
                          name="customSpecies"
                          value={customSpecies}
                          onChange={handleCustomInputChange}
                          placeholder="Введите вид животного"
                          className={`mt-2 ${fieldErrors.species ? "input-error" : customSpecies ? "field-valid" : ""}`}
                          required
                        />
                      )}
                      {fieldErrors.species && (
                        <div className="field-error-message">{fieldErrors.species}</div>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="admin-pet-breed">Порода</label>
                      <StyledSelect
                        id="admin-pet-breed"
                        value={isOtherBreed ? 'Другое' : formData.breed}
                        onChange={handleSelectField('breed')}
                        options={breedFormOptions}
                        required
                        triggerClassName={
                          fieldErrors.breed ? 'input-error' : formData.breed ? 'field-valid' : ''
                        }
                        aria-label="Порода"
                      />
                      {isOtherBreed && (
                        <input
                          type="text"
                          name="customBreed"
                          value={customBreed}
                          onChange={handleCustomInputChange}
                          placeholder="Введите породу"
                          className={`mt-2 ${fieldErrors.breed ? "input-error" : customBreed ? "field-valid" : ""}`}
                          required
                        />
                      )}
                      {fieldErrors.breed && (
                        <div className="field-error-message">{fieldErrors.breed}</div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="form-section">
                  <h4 className="form-section-title">Местоположение и контакты</h4>
                
                  <div className="form-row">
                    <div className="form-group">
                      <label>Местоположение</label>
                      <input
                        type="text"
                        name="area"
                        value={formData.area}
                        onChange={handleInputChange}
                        placeholder="Город, район"
                        className={fieldErrors.area ? "input-error" : ""}
                      />
                      {fieldErrors.area && (
                        <div className="field-error-message">{fieldErrors.area}</div>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="admin-pet-shelter">Приют</label>
                      <StyledSelect
                        id="admin-pet-shelter"
                        value={
                          formData.shelter_id != null && formData.shelter_id !== ''
                            ? String(formData.shelter_id)
                            : ''
                        }
                        onChange={handleSelectField('shelter_id')}
                        options={shelterFormOptions}
                        required
                        triggerClassName={
                          fieldErrors.shelter_id ? 'input-error' : formData.shelter_id ? 'field-valid' : ''
                        }
                        aria-label="Приют"
                      />
                      {fieldErrors.shelter_id && (
                        <div className="field-error-message">{fieldErrors.shelter_id}</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label>Email для контакта</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="Контактный email"
                        className={fieldErrors.email ? "input-error" : formData.email ? "field-valid" : ""}
                      />
                      {fieldErrors.email && (
                        <div className="field-error-message">{fieldErrors.email}</div>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label>Телефон для контакта</label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="Формат: +375XXXXXXXXX"
                        className={fieldErrors.phone ? "input-error" : formData.phone ? "field-valid" : ""}
                      />
                      {fieldErrors.phone && (
                        <div className="field-error-message">{fieldErrors.phone}</div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="form-section">
                  <h4 className="form-section-title">Описание</h4>
                
                  <div className="form-group">
                    <label>Описание</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Подробное описание питомца (минимум 20 символов)"
                      rows="4"
                      className={fieldErrors.description ? "input-error" : formData.description.length >= 20 ? "field-valid" : ""}
                      required
                    ></textarea>
                    {fieldErrors.description && (
                      <div className="field-error-message">{fieldErrors.description}</div>
                    )}
                    <div className="char-counter">
                      {formData.description.length}/20 символов минимум
                    </div>
                  </div>
                </div>
                
                <div className="form-section">
                  <h4 className="form-section-title">Фотография</h4>
                  
                  <div className="form-group">
                    <label>Фотография питомца</label>
                    <div className="adopt-form-file-input">
                      <input
                        type="file"
                        id="pet-photo-edit"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="file-input"
                      />
                      <label htmlFor="pet-photo-edit" className="adopt-form-file-label">
                        {fileName ? fileName : "Выберите новую фотографию питомца"}
                      </label>
                      <small className="field-note">Оставьте пустым, чтобы сохранить текущее изображение</small>
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h4 className="form-section-title">Характеристики питомца</h4>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="admin-pet-size">Размер</label>
                      <StyledSelect
                        id="admin-pet-size"
                        value={formData.size}
                        onChange={handleSelectField('size')}
                        options={ADMIN_PET_SIZE_OPTIONS}
                        triggerClassName={fieldErrors.size ? 'input-error' : 'field-valid'}
                        aria-label="Размер"
                      />
                      {fieldErrors.size && (
                        <div className="field-error-message">{fieldErrors.size}</div>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="admin-pet-energy">Уровень энергии</label>
                      <StyledSelect
                        id="admin-pet-energy"
                        value={formData.energyLevel}
                        onChange={handleSelectField('energyLevel')}
                        options={ADMIN_PET_ENERGY_OPTIONS}
                        triggerClassName={fieldErrors.energyLevel ? 'input-error' : 'field-valid'}
                        aria-label="Уровень энергии"
                      />
                      {fieldErrors.energyLevel && (
                        <div className="field-error-message">{fieldErrors.energyLevel}</div>
                      )}
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="admin-pet-care">Уровень ухода</label>
                      <StyledSelect
                        id="admin-pet-care"
                        value={formData.careLevel}
                        onChange={handleSelectField('careLevel')}
                        options={ADMIN_PET_CARE_OPTIONS}
                        triggerClassName={fieldErrors.careLevel ? 'input-error' : 'field-valid'}
                        aria-label="Уровень ухода"
                      />
                      {fieldErrors.careLevel && (
                        <div className="field-error-message">{fieldErrors.careLevel}</div>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="admin-pet-activity">Потребности в активности</label>
                      <StyledSelect
                        id="admin-pet-activity"
                        value={formData.activityNeeds}
                        onChange={handleSelectField('activityNeeds')}
                        options={ADMIN_PET_ACTIVITY_OPTIONS}
                        triggerClassName={fieldErrors.activityNeeds ? 'input-error' : 'field-valid'}
                        aria-label="Потребности в активности"
                      />
                      {fieldErrors.activityNeeds && (
                        <div className="field-error-message">{fieldErrors.activityNeeds}</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h4 className="form-section-title">Темперамент</h4>
                  
                  <div className="form-group">
                    <label>Черты характера</label>
                    <div className="trait-buttons">
                      {availableTemperaments.map((trait) => (
                        <button
                          key={trait}
                          type="button"
                          className={`trait-button ${(formData.temperamentTraits || []).includes(trait) ? 'selected' : ''}`}
                          onClick={() => handleTemperamentChange(trait)}
                        >
                          {trait}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="trait-button add-trait"
                        onClick={() => {
                          const newState = !showCustomTemperament;
                          setShowCustomTemperament(newState);
                          // Очищаем ошибку и поле при открытии
                          if (newState) {
                            setTemperamentError('');
                            setCustomTemperament('');
                          }
                        }}
                      >
                        + Добавить свою
                      </button>
                    </div>
                    
                    {showCustomTemperament && (
                      <div className="custom-trait-input-wrapper">
                        <div className="custom-trait-input">
                          <input
                            type="text"
                            name="customTemperament"
                            value={customTemperament}
                            onChange={handleCustomInputChange}
                            placeholder="Например: дружелюбный"
                            className={`adopt-form-input ${temperamentError ? 'input-error' : ''}`}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddCustomTemperament();
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="add-trait-btn"
                            onClick={handleAddCustomTemperament}
                          >
                            Добавить
                          </button>
                        </div>
                        {temperamentError && (
                          <div className="temperament-error-message">
                            {temperamentError}
                          </div>
                        )}
                        <small className="temperament-hint">Черта будет автоматически отформатирована как "дружелюбный(-ая)"</small>
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-section">
                  <h4 className="form-section-title">Совместимость и здоровье</h4>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          name="isKidFriendly"
                          checked={formData.isKidFriendly}
                          onChange={(e) => setFormData({...formData, isKidFriendly: e.target.checked})}
                        />
                        <span>Подходит для детей</span>
                      </label>
                    </div>
                    
                    <div className="form-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          name="isPetFriendly"
                          checked={formData.isPetFriendly}
                          onChange={(e) => setFormData({...formData, isPetFriendly: e.target.checked})}
                        />
                        <span>Подходит для других животных</span>
                      </label>
                    </div>
                    
                    <div className="form-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          name="hypoallergenic"
                          checked={formData.hypoallergenic}
                          onChange={(e) => setFormData({...formData, hypoallergenic: e.target.checked})}
                        />
                        <span>Гипоаллергенный</span>
                      </label>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Медицинские заметки</label>
                    <textarea
                      name="medicalNotes"
                      value={formData.medicalNotes}
                      onChange={handleInputChange}
                      placeholder="Информация о здоровье, прививках, особых потребностях"
                      rows="3"
                      className="adopt-form-input"
                    ></textarea>
                  </div>
                </div>
                
                <div className="form-actions">
                  <button type="button" className="cancel-btn" onClick={() => setShowEditForm(false)}>
                    Отмена
                  </button>
                  <button type="submit" className="submit-btn">
                    Сохранить изменения
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {/* Pets List */}
      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Загрузка питомцев...</p>
        </div>
      ) : filteredPets.length > 0 ? (
        <div className="pets-grid">
          {filteredPets.map(pet => {
            const shelter = shelters.find(s => s._id === pet.shelter_id);
            return (
              <div key={pet._id} className="pet-card improved-pet-card">
                <div className="pet-card-header improved-pet-card-header">
                  <div className="pet-image improved-pet-image">
                    <img
                      src={getPetImageUrl(pet.filename)}
                      alt={pet.name}
                      onError={(e) => {
                        e.target.src = "/api/images/default.jpg";
                      }}
                    />
                  </div>
                  <div className="pet-details improved-pet-details">
                    <h2 className="pet-name">{pet.name}</h2>
                    <div className="pet-info improved-pet-info">
                      <div className="pet-info-row"><span className="pet-info-label">Вид:</span> <span className="pet-info-value">{pet.species}</span></div>
                      <div className="pet-info-row"><span className="pet-info-label">Порода:</span> <span className="pet-info-value">{pet.breed}</span></div>
                      <div className="pet-info-row"><span className="pet-info-label">Возраст:</span> <span className="pet-info-value">{formatAge(pet.birthDate)}</span></div>
                      {pet.size && <div className="pet-info-row"><span className="pet-info-label">Размер:</span> <span className="pet-info-value">{pet.size === 'small' ? 'Маленький' : pet.size === 'medium' ? 'Средний' : 'Большой'}</span></div>}
                      {pet.energyLevel && <div className="pet-info-row"><span className="pet-info-label">Энергия:</span> <span className="pet-info-value">{pet.energyLevel === 'low' ? 'Низкая' : pet.energyLevel === 'medium' ? 'Средняя' : 'Высокая'}</span></div>}
                      {pet.temperamentTraits && pet.temperamentTraits.length > 0 && (
                        <div className="pet-info-row">
                          <span className="pet-info-label">Темперамент:</span> 
                          <span className="pet-info-value">{pet.temperamentTraits.slice(0, 3).join(', ')}{pet.temperamentTraits.length > 3 ? '...' : ''}</span>
                        </div>
                      )}
                      <div className="pet-info-row"><span className="pet-info-label">Статус:</span> <span className={getStatusBadgeClass(pet.status)}>{getStatusText(pet.status)}</span></div>
                      {shelter && <div className="pet-info-row"><span className="pet-info-label">Приют:</span> <span className="pet-info-value">{shelter.name}</span></div>}
                      <div className="pet-info-row"><span className="pet-info-label">Создан:</span> <span className="pet-info-value">{formatTimeAgo(pet.createdAt)}</span></div>
                    </div>
                  </div>
                  <div className="pet-actions">
                    <button 
                      className="edit-btn"
                      onClick={() => handleEditPet(pet)}
                      title="Редактировать"
                    >
                      <span className="action-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M18.5 2.50001C18.8978 2.10219 19.4374 1.87869 20 1.87869C20.5626 1.87869 21.1022 2.10219 21.5 2.50001C21.8978 2.89784 22.1213 3.43741 22.1213 4.00001C22.1213 4.56262 21.8978 5.10219 21.5 5.50001L12 15L8 16L9 12L18.5 2.50001Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                    </button>
                    
                    {/* Кнопка удаления доступна для всех питомцев */}
                      <button 
                        className="delete-btn"
                        onClick={() => handleDeletePet(pet)}
                        title="Удалить"
                      >
                        <span className="action-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 6H5H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6L18.2 20C18.1444 20.5312 17.8904 21.0226 17.4897 21.3753C17.089 21.728 16.5713 21.9166 16.037 21.9054H7.963C7.42868 21.9166 6.91098 21.728 6.51029 21.3753C6.10961 21.0226 5.85558 20.5312 5.8 20L5 6H19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </span>
                      </button>
                  </div>
                </div>
                <div className="pet-description improved-pet-description">
                  <h3>Описание</h3>
                  <div className="pet-description-text">{pet.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="no-results">
          <div className="no-results-icon">🐾</div>
          <h3>Питомцы не найдены</h3>
          <p>По текущим фильтрам не найдено питомцев. Попробуйте изменить критерии поиска или добавьте нового питомца.</p>
        </div>
      )}
    </div>
  );
};

export default PetManagement; 