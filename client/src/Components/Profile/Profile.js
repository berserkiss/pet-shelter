import React, { useState, useEffect, useRef } from 'react';
import { useAuthContext } from '../../hooks/UseAuthContext';
import './Profile.css';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import axios from 'axios';
import { getSocketServerUrl } from '../../utils/socketServerUrl';
import PreferencesFromChat from './PreferencesFromChat';
import PetCareCalendar from '../PetCare/PetCareCalendar';
import StyledSelect from '../UI/StyledSelect';
import AdoptionApplications from './AdoptionApplications';
import VolunteerApplications from './VolunteerApplications';
import UserPetSubmissions from './UserPetSubmissions';
import DonationHistory from './DonationHistory';
import FavoritePets from './FavoritePets';
import './DonationHistory.css';
import {
  IconAdoptionApps,
  IconVolunteer,
  IconHousePets,
  IconCalendarCare,
  IconDonationHeart,
  IconStarFavorite,
  IconUserProfile,
  IconPreferences,
  IconPencilEdit,
  IconSave
} from './icons/ProfileSidebarIcons';

const Profile = () => {
    const { user, dispatch, forceLogout } = useAuthContext();
    const [isEditing, setIsEditing] = useState(false);
    const [editValues, setEditValues] = useState({ name: user ? user.userName : '', email: user ? user.email : '' });
    const [tempValues, setTempValues] = useState({ name: user ? user.userName : '' });
    const [errors, setErrors] = useState([]);
    const [succMessage, setSuccMessage] = useState("");
    const [applications, setApplications] = useState([]);
    const [volunteerApplications, setVolunteerApplications] = useState([]);
    const [petSubmissions, setPetSubmissions] = useState([]);
    const [donations, setDonations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [volunteerLoading, setVolunteerLoading] = useState(true);
    const [petsLoading, setPetsLoading] = useState(true);
    const [donationsLoading, setDonationsLoading] = useState(true);
    const [calendarsLoading, setCalendarsLoading] = useState(true);
    const [calendars, setCalendars] = useState([]);
    const [activeSection, setActiveSection] = useState('profile');
    const [recentlyUpdatedApps, setRecentlyUpdatedApps] = useState({});
    const [recentlyUpdatedVolunteerApps, setRecentlyUpdatedVolunteerApps] = useState({});
    const [recentlyUpdatedPetSubmissions, setRecentlyUpdatedPetSubmissions] = useState({});
    const [recentlyUpdatedDonations, setRecentlyUpdatedDonations] = useState({});
    const [recentlyUpdatedFavorites, setRecentlyUpdatedFavorites] = useState({});
    const [favoritesLoading, setFavoritesLoading] = useState(true);
    const [favoritesCount, setFavoritesCount] = useState(0);
    const [selectedPetId, setSelectedPetId] = useState(null); // Для выбора календаря питомца
    const socketRef = useRef(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
    const [deleteError, setDeleteError] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);

    const needsPassword = user?.hasPassword ?? (user?.authProvider !== 'google');

    // Функция для определения статуса заявки (аналогично AdoptionApplications)
    const getApplicationStatus = React.useCallback((application) => {
        // Приоритет: статус из самой заявки
        if (application.status) {
            return application.status;
        }
        
        // Если статуса в заявке нет, используем статус питомца
        if (!application.petDetails) return "Pending";
        
        // Проверяем, если питомец усыновлен, но email усыновителя не совпадает с текущим пользователем
        if (application.petDetails.status === 'Adopted' && 
            application.petDetails.adopter_email && 
            application.petDetails.adopter_email !== application.email) {
            return "Rejected";
        }
        
        switch(application.petDetails.status) {
            case 'Adopted':
                // Если питомец усыновлен и это заявка текущего пользователя - считаем ее одобренной
                if (application.petDetails.adopter_email === application.email) {
                    return "Approved";
                }
                return "Rejected";
            case 'InReview':
                return "InReview";
            case 'Approved':
                return "Approved";
            case 'Pending':
            default:
                return "Pending";
        }
    }, []);

    // Вычисляем список усыновленных питомцев (только с одобренными заявками)
    const allAdoptedPets = React.useMemo(() => {
        // 1. Только одобренные заявки на усыновление
        const adoptedFromApplications = applications
            .filter(app => {
                if (!app.petDetails) return false;
                
                // Проверяем статус заявки - должна быть Approved
                const appStatus = getApplicationStatus(app);
                if (appStatus !== 'Approved') return false;
                
                // Дополнительная проверка: питомец должен быть Approved или Adopted
                return app.petDetails.status === 'Approved' || 
                       (app.petDetails.status === 'Adopted' && app.petDetails.adopter_email === user?.email);
            })
            .map(app => ({
                _id: app.petDetails._id,
                name: app.petDetails.name,
                source: 'application'
            }));

        // 2. Собственные питомцы, которые были усыновлены (эти не требуют заявки)
        const adoptedFromSubmissions = petSubmissions
            .filter(pet => pet.status === 'Adopted')
            .map(pet => ({
                _id: pet._id,
                name: pet.name,
                source: 'submission'
            }));

        // Объединяем и удаляем дубликаты
        return [...adoptedFromApplications, ...adoptedFromSubmissions]
            .filter((pet, index, self) => 
                index === self.findIndex(p => p._id === pet._id)
            );
    }, [applications, petSubmissions, user?.email, getApplicationStatus]);

    // Устанавливаем начальное значение selectedPetId когда появляются питомцы
    useEffect(() => {
        if (!selectedPetId && allAdoptedPets.length > 0) {
            setSelectedPetId(allAdoptedPets[0]._id);
        }
        // Если выбранный питомец больше не существует, сбрасываем выбор
        if (selectedPetId && !allAdoptedPets.find(p => p._id === selectedPetId)) {
            setSelectedPetId(allAdoptedPets.length > 0 ? allAdoptedPets[0]._id : null);
        }
    }, [allAdoptedPets, selectedPetId]);

    // Memoize fetchApplications to prevent infinite dependency cycles
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const fetchApplications = React.useCallback(async () => {
        if (!user) return;
        
        try {
            setLoading(true);
            // Query by user ID if available, otherwise by email
            const queryParam = user._id ? `userId=${user._id}` : `email=${user.email}`;
            const endpoint = `/api/form/user?${queryParam}`;
            
            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': `Bearer ${user.token}`
                }
            });
            
            // Handle token expiration
            if (response.status === 401) {
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
                        return fetchApplications();
                    }
                } catch (refreshError) {
                    console.error('Failed to refresh token:', refreshError);
                    throw new Error('Authentication failed - please login again');
                }
            }
            
            if (!response.ok) {
                throw new Error('Failed to fetch applications');
            }
            
            const data = await response.json();
            console.log('Fetched applications:', data);
            
            // Fetch shelter details for each application
            const applicationsWithShelterDetails = await Promise.all(
                data.map(async (app) => {
                    if (app.petDetails && app.petDetails.shelter_id) {
                        try {
                            const shelterResponse = await fetch(`/api/shelters/${app.petDetails.shelter_id}`, {
                                headers: {
                                    'Authorization': `Bearer ${user.token}`
                                }
                            });
                            
                            if (shelterResponse.ok) {
                                const shelterData = await shelterResponse.json();
                                return {
                                    ...app,
                                    petDetails: {
                                        ...app.petDetails,
                                        shelterDetails: shelterData,
                                        shelter_name: shelterData.name,
                                        shelter_city: shelterData.city || null,
                                        shelter_address: shelterData.street && shelterData.house 
                                            ? `${shelterData.street}, ${shelterData.house}` 
                                            : null,
                                        shelter_phone: shelterData.phone || null,
                                        shelter_email: shelterData.email || null
                                    }
                                };
                            }
                        } catch (error) {
                            console.error(`Error fetching shelter details for application ${app._id}:`, error);
                        }
                    }
                    return app;
                })
            );
            
            setApplications(applicationsWithShelterDetails);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching applications:', error);
            setLoading(false);
        }
    }, [user, dispatch]);

    // Fetch volunteer applications
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const fetchVolunteerApplications = React.useCallback(async () => {
        if (!user) return;
        
        try {
            setVolunteerLoading(true);
            // Query by user ID if available, otherwise by email
            const queryParam = user._id ? `userId=${user._id}` : `email=${user.email}`;
            const endpoint = `/api/volunteers?${queryParam}`;
            
            console.log('Fetching volunteer applications from:', endpoint); // Add logging
            
            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': `Bearer ${user.token}`
                }
            });
            
            // Handle token expiration
            if (response.status === 401) {
                try {
                    console.log('Token expired during volunteer data fetch, attempting to refresh...');
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
                        
                        // Update sessionStorage and context
                        sessionStorage.setItem('user', JSON.stringify(updatedUser));
                        sessionStorage.setItem('token', token);
                        dispatch({ type: 'LOGIN', payload: updatedUser });
                        
                        // Retry fetch
                        return fetchVolunteerApplications();
                    }
                } catch (refreshError) {
                    console.error('Failed to refresh token:', refreshError);
                    throw new Error('Authentication failed - please login again');
                }
            }
            
            if (!response.ok) {
                throw new Error('Failed to fetch volunteer applications');
            }
            
            const data = await response.json();
            console.log('Fetched volunteer applications:', data); // Add logging
            
            // Fetch shelter details for each application if shelter_id exists
            const applicationWithShelterDetails = await Promise.all(
                data.map(async (app) => {
                    if (app.shelter_id) {
                        try {
                            const shelterResponse = await fetch(`/api/shelters/${app.shelter_id}`, {
                                headers: {
                                    'Authorization': `Bearer ${user.token}`
                                }
                            });
                            
                            if (shelterResponse.ok) {
                                const shelterData = await shelterResponse.json();
                                return {
                                    ...app,
                                    shelter_name: shelterData.name,
                                    shelter_city: shelterData.city || null,
                                    shelter_address: shelterData.street && shelterData.house 
                                        ? `${shelterData.street}, ${shelterData.house}` 
                                        : null,
                                    shelterDetails: shelterData
                                };
                            }
                        } catch (error) {
                            console.error(`Error fetching shelter details for application ${app._id}:`, error);
                        }
                    }
                    return app;
                })
            );
            
            setVolunteerApplications(applicationWithShelterDetails);
            setVolunteerLoading(false);
        } catch (error) {
            console.error('Error fetching volunteer applications:', error);
            setVolunteerLoading(false);
        }
    }, [user, dispatch]);

    // Fetch calendars
    const fetchCalendars = React.useCallback(async () => {
        if (!user) return;
        
        try {
            setCalendarsLoading(true);
            const response = await fetch('/api/pet-care/calendars', {
                headers: {
                    'Authorization': `Bearer ${user.token}`
                }
            });
            
            if (response.status === 401) {
                try {
                    const refreshResponse = await axios.post('/api/user/refresh-token', {}, {
                        withCredentials: true
                    });
                    
                    if (refreshResponse.data && refreshResponse.data.token) {
                        const { token, userName, email, role } = refreshResponse.data;
                        const updatedUser = { 
                            userName, 
                            email, 
                            token, 
                            role: role || (user ? user.role : 'user')
                        };
                        sessionStorage.setItem('user', JSON.stringify(updatedUser));
                        sessionStorage.setItem('token', token);
                        dispatch({ type: 'LOGIN', payload: updatedUser });
                        return fetchCalendars();
                    }
                } catch (refreshError) {
                    console.error('Failed to refresh token:', refreshError);
                }
            }
            
            if (!response.ok) {
                throw new Error('Failed to fetch calendars');
            }
            
            const data = await response.json();
            setCalendars(Array.isArray(data) ? data : []);
            setCalendarsLoading(false);
        } catch (error) {
            console.error('Error fetching calendars:', error);
            setCalendarsLoading(false);
        }
    }, [user, dispatch]);

    // Fetch pet submissions
    const fetchPetSubmissions = React.useCallback(async () => {
        if (!user) return;
        
        try {
            setPetsLoading(true);
            // Query by user ID if available, otherwise by email
            const queryParam = user._id ? `userId=${user._id}` : `email=${user.email}`;
            const endpoint = `/api/admin-pets/user?${queryParam}`;
            
            console.log('Fetching pet submissions from:', endpoint); // Add logging
            
            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': `Bearer ${user.token}`
                }
            });
            
            // Handle token expiration
            if (response.status === 401) {
                try {
                    console.log('Token expired during pet submissions fetch, attempting to refresh...');
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
                        
                        // Update sessionStorage and context
                        sessionStorage.setItem('user', JSON.stringify(updatedUser));
                        sessionStorage.setItem('token', token);
                        dispatch({ type: 'LOGIN', payload: updatedUser });
                        
                        // Retry fetch
                        return fetchPetSubmissions();
                    }
                } catch (refreshError) {
                    console.error('Failed to refresh token:', refreshError);
                    throw new Error('Authentication failed - please login again');
                }
            }
            
            if (!response.ok) {
                throw new Error('Failed to fetch pet submissions');
            }
            
            const data = await response.json();
            console.log('Fetched pet submissions:', data); // Add logging
            
            // Fetch shelter details for each pet submission
            const submissionsWithShelterDetails = await Promise.all(
                data.map(async (pet) => {
                    if (pet.shelter_id) {
                        try {
                            const shelterResponse = await fetch(`/api/shelters/${pet.shelter_id}`, {
                                headers: {
                                    'Authorization': `Bearer ${user.token}`
                                }
                            });
                            
                            if (shelterResponse.ok) {
                                const shelterData = await shelterResponse.json();
                                return {
                                    ...pet,
                                    shelterDetails: shelterData
                                };
                            }
                        } catch (error) {
                            console.error(`Error fetching shelter details for pet ${pet._id}:`, error);
                        }
                    }
                    return pet;
                })
            );
            
            setPetSubmissions(submissionsWithShelterDetails);
            setPetsLoading(false);
        } catch (error) {
            console.error('Error fetching pet submissions:', error);
            setPetsLoading(false);
        }
    }, [user, dispatch]);

    // Fetch donations
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const fetchDonations = React.useCallback(async () => {
        if (!user) return;
        
        try {
            setDonationsLoading(true);
            const response = await fetch('/api/donations/user/my-donations', {
                headers: {
                    'Authorization': `Bearer ${user.token}`
                }
            });
            
            // Handle token expiration
            if (response.status === 401) {
                try {
                    console.log('Token expired during donations fetch, attempting to refresh...');
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
                        
                        // Update sessionStorage and context
                        sessionStorage.setItem('user', JSON.stringify(updatedUser));
                        sessionStorage.setItem('token', token);
                        dispatch({ type: 'LOGIN', payload: updatedUser });
                        
                        // Retry fetch
                        return fetchDonations();
                    }
                } catch (refreshError) {
                    console.error('Failed to refresh token:', refreshError);
                    throw new Error('Authentication failed - please login again');
                }
            }
            
            if (!response.ok) {
                throw new Error('Failed to fetch donations');
            }
            
            const data = await response.json();
            console.log('Fetched donations:', data);
            
            setDonations(data);
            setDonationsLoading(false);
        } catch (error) {
            console.error('Error fetching donations:', error);
            setDonationsLoading(false);
        }
    }, [user, dispatch]);

    // Fetch favorites count
    const fetchFavoritesCount = React.useCallback(async () => {
        if (!user) return;
        
        try {
            const response = await fetch('/api/favorites', {
                headers: {
                    'Authorization': `Bearer ${user.token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                setFavoritesCount(data.favorites?.length || 0);
            }
        } catch (error) {
            console.error('Ошибка загрузки количества избранного:', error);
        }
    }, [user]);

    // Обновление локальных данных при изменении данных пользователя
    useEffect(() => {
        if (user) {
            setEditValues({ 
                name: user.userName || '', 
                email: user.email || '' 
            });
            setTempValues({ 
                name: user.userName || ''
                // email не включаем в tempValues, так как его нельзя редактировать
            });
        }
    }, [user]);

    // Перевод статуса на русский и добавление иконок
    const translateStatus = (status) => {
        switch(status) {
            case 'Approved':
                return 'Принята';
            case 'InReview':
                return 'Рассматривается';
            case 'Pending':
                return 'Ожидает рассмотрения';
            case 'Rejected':
                return 'Отклонена';
            default:
                return status;
        }
    };
    
    // Перевод статуса волонтерской заявки
    const translateVolunteerStatus = (status) => {
        switch(status) {
            case 'Approved':
                return 'Одобрено';
            case 'Pending':
                return 'Ожидает рассмотрения';
            case 'Rejected':
                return 'Отклонено';
            default:
                return status;
        }
    };
    
    // Перевод статуса заявки на добавление животного
    const translatePetStatus = (status) => {
        switch(status) {
            case 'Approved':
                return 'Размещено';
            case 'InReview':
                return 'На рассмотрении';
            case 'Pending':
                return 'Ожидает рассмотрения';
            case 'Rejected':
                return 'Отклонено';
            case 'Adopted':
                return 'Усыновлен';
            default:
                return status;
        }
    };

    // Инициализация WebSocket
    useEffect(() => {
        if (!user) return;

        // Используем глобальный сокет, если он существует и подключен
        if (window.globalSocket && window.globalSocket.connected) {
            console.log('Using existing socket connection in Profile component');
            socketRef.current = window.globalSocket;
        } else {
            // Иначе создаем новое подключение
            console.log('Creating new socket connection in Profile component');
            socketRef.current = io(getSocketServerUrl(), {
                path: '/socket.io',
                auth: {
                    token: user.token ? user.token : undefined
                }
            });
            
            // Кэшируем сокет для повторного использования
            window.globalSocket = socketRef.current;
        }

        // Всегда гарантируем слушатель блокировки на текущем сокете
        if (!socketRef.current.__blockedListenerAttached) {
            socketRef.current.on('userBlocked', () => {
                forceLogout(true);
            });
            socketRef.current.__blockedListenerAttached = true;
        }
        
        // Подписываемся на обновления заявок текущего пользователя
        socketRef.current.on('connect', () => {
            console.log('WebSocket подключен');
            // Подписываемся на события для этого пользователя по email
            socketRef.current.emit('joinRoom', `user:${user.email}`);
            
            // Также подписываемся на события по user_id если доступен
            if (user._id) {
                socketRef.current.emit('joinRoom', `userId:${user._id}`);
            }
            
            // Подписываемся на комнату обновлений заявок
            socketRef.current.emit('joinRoom', `applications:${user.email}`);
        });
        
        // Listen for token expiration
        socketRef.current.on('tokenExpired', async () => {
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
              socketRef.current.disconnect();
              socketRef.current.auth = { token };
              socketRef.current.connect();
              
              console.log('Token refreshed, socket reconnected');
            }
          } catch (error) {
            console.error('Failed to refresh token from socket event:', error);
            }
        });
        
        // Обработчик обновления статуса заявки
        socketRef.current.on('formUpdate', (updatedForm) => {
            console.log('Получено обновление заявки через WebSocket:', updatedForm);
            
            // Проверяем, относится ли заявка к текущему пользователю
            if (updatedForm.email === user.email) {
            // Показываем уведомление
            if (Notification.permission === 'granted') {
                    const statusText = translateStatus(updatedForm.status);
                const notification = new Notification('Обновление статуса заявки', {
                    body: `Статус вашей заявки изменен на: ${statusText}`,
                    icon: '/favicon.ico'
                });
                
                notification.onclick = () => {
                    window.focus();
                    setActiveSection('applications');
                };
            }
            
            // Обновляем заявку в списке
            setApplications(prevApps => {
                return prevApps.map(app => {
                        if (app._id === updatedForm._id) {
                        // Отмечаем что эта заявка была недавно обновлена
                        setRecentlyUpdatedApps(prev => ({
                            ...prev,
                                [updatedForm._id]: true
                            }));

                            // Через 5 секунд снимаем отметку
                            setTimeout(() => {
                                setRecentlyUpdatedApps(prev => ({
                                    ...prev,
                                    [updatedForm._id]: false
                                }));
                            }, 5000);
                            
                            return {
                                ...app,
                                ...updatedForm,
                                statusChanged: true
                            };
                        }
                        return app;
                    });
                });

                // Если пользователь не находится в разделе заявок, показываем уведомление
                if (activeSection !== 'applications') {
                    // Добавляем визуальное уведомление на странице
                    const successMessage = `Статус заявки обновлен на: ${translateStatus(updatedForm.status)}`;
                    setSuccMessage(successMessage);
                    setTimeout(() => setSuccMessage(""), 5000);
                }
            }
        });
        
        // Обработчик обновления статуса волонтерской заявки
        socketRef.current.on('volunteerStatusUpdate', (updatedVolunteer) => {
            console.log('Получено обновление волонтерской заявки через WebSocket:', updatedVolunteer);
            
            // Проверяем, относится ли заявка к текущему пользователю
            if (updatedVolunteer.email === user.email) {
                // Показываем уведомление
                if (Notification.permission === 'granted') {
                    const statusText = translateVolunteerStatus(updatedVolunteer.status);
                    const notification = new Notification('Обновление статуса волонтерской заявки', {
                        body: `Статус вашей заявки изменен на: ${statusText}`,
                        icon: '/favicon.ico'
                    });
                    
                    notification.onclick = () => {
                        window.focus();
                        setActiveSection('volunteer');
                    };
                }
                
                // Обновляем заявку в списке
                setVolunteerApplications(prevApps => {
                    return prevApps.map(app => {
                        if (app._id === updatedVolunteer._id) {
                            // Отмечаем что эта заявка была недавно обновлена
                            setRecentlyUpdatedVolunteerApps(prev => ({
                                ...prev,
                                [updatedVolunteer._id]: true
                            }));

                            // Через 5 секунд снимаем отметку
                            setTimeout(() => {
                                setRecentlyUpdatedVolunteerApps(prev => ({
                                    ...prev,
                                    [updatedVolunteer._id]: false
                                }));
                            }, 5000);
                            
                            return {
                                ...app,
                                ...updatedVolunteer,
                                statusChanged: true
                            };
                        }
                        return app;
                    });
                });

                // Если пользователь не находится в разделе волонтерства, показываем уведомление
                if (activeSection !== 'volunteer') {
                    // Добавляем визуальное уведомление на странице
                    const successMessage = `Статус волонтерской заявки обновлен на: ${translateVolunteerStatus(updatedVolunteer.status)}`;
                    setSuccMessage(successMessage);
                    setTimeout(() => setSuccMessage(""), 5000);
                }
            }
        });
        
        // Обработчик обновления статуса питомца (для отслеживания усыновлений)
        socketRef.current.on('petRequestUpdate', (updatedPet) => {
            console.log('Получено обновление питомца через WebSocket:', updatedPet);
            
            // Обновляем информацию о питомце в заявках на усыновление
            setApplications(prevApps => {
                return prevApps.map(app => {
                    if (app.petId === updatedPet._id) {
                        // Если питомец был усыновлен другим пользователем, обновляем статус заявки
                        if (updatedPet.status === 'Adopted' && updatedPet.adopter_email && updatedPet.adopter_email !== user.email) {
                            // Отмечаем заявку как отклоненную, если питомец был усыновлен другим пользователем
                            setRecentlyUpdatedApps(prev => ({
                                ...prev,
                                [app._id]: true
                            }));
                            
                        setTimeout(() => {
                                setRecentlyUpdatedApps(prev => ({
                                    ...prev,
                                    [app._id]: false
                                }));
                            }, 5000);
                            
                            // Показываем уведомление
                            if (Notification.permission === 'granted') {
                                const notification = new Notification('Питомец был усыновлен', {
                                    body: `К сожалению, питомец ${updatedPet.name} был усыновлен другим пользователем.`,
                                    icon: '/favicon.ico'
                                });
                                
                                notification.onclick = () => {
                                    window.focus();
                                    setActiveSection('applications');
                                };
                            }
                            
                            return {
                                ...app,
                                petDetails: {
                                    ...app.petDetails,
                                    ...updatedPet
                                },
                                status: 'Rejected',
                                statusChanged: true
                            };
                        } else if (updatedPet.status === 'Adopted' && updatedPet.adopter_email === user.email) {
                            // Если питомец был усыновлен текущим пользователем
                            setRecentlyUpdatedApps(prev => ({
                                ...prev,
                                [app._id]: true
                            }));
                            
                            setTimeout(() => {
                                setRecentlyUpdatedApps(prev => ({
                                    ...prev,
                                    [app._id]: false
                            }));
                            }, 5000);
                        
                        return {
                            ...app,
                                petDetails: {
                                    ...app.petDetails,
                                    ...updatedPet
                                },
                                status: 'Approved',
                            statusChanged: true
                        };
                        } else {
                            // Обновляем только информацию о питомце
                            return {
                                ...app,
                                petDetails: {
                                    ...app.petDetails,
                                    ...updatedPet
                                }
                            };
                        }
                    }
                    return app;
                });
            });
            
            // Обновляем информацию о питомце в поданных заявках на добавление питомцев
            setPetSubmissions(prevSubmissions => {
                // Проверяем, является ли текущий пользователь владельцем этого питомца
                if (updatedPet.email === user.email) {
                    return prevSubmissions.map(submission => {
                        if (submission._id === updatedPet._id) {
                            // Отмечаем заявку как обновленную
                            setRecentlyUpdatedPetSubmissions(prev => ({
                                ...prev,
                                [updatedPet._id]: true
                            }));
                            
                            setTimeout(() => {
                                setRecentlyUpdatedPetSubmissions(prev => ({
                                    ...prev,
                                    [updatedPet._id]: false
                                }));
                            }, 5000);
                            
                            // Показываем уведомление
                            if (Notification.permission === 'granted') {
                                const statusText = translatePetStatus(updatedPet.status);
                                const notification = new Notification('Обновление статуса заявки на добавление питомца', {
                                    body: `Статус заявки для ${updatedPet.name} изменен на: ${statusText}`,
                                    icon: '/favicon.ico'
                                });
                                
                                notification.onclick = () => {
                                    window.focus();
                                    setActiveSection('petSubmissions');
                                };
                            }
                            
                            return {
                                ...submission,
                                ...updatedPet,
                                statusChanged: true
                            };
                        }
                        return submission;
                    });
                }
                return prevSubmissions;
            });
        });
        
        // Обработчик для новых заявок на усыновление
        socketRef.current.on('newForm', (newForm) => {
            // Проверяем, относится ли заявка к текущему пользователю
            if (newForm.email === user.email) {
                setApplications(prevApps => {
                    // Проверяем, нет ли уже такой заявки в списке
                    if (prevApps.some(app => app._id === newForm._id)) {
                        return prevApps;
                    }
                    return [...prevApps, newForm];
                });
            }
        });
        
        // Обработчик для новых заявок на волонтерство
        socketRef.current.on('volunteerApplication', (newVolunteer) => {
            // Проверяем, относится ли заявка к текущему пользователю
            if (newVolunteer.email === user.email) {
                setVolunteerApplications(prevApps => {
                    // Проверяем, нет ли уже такой заявки в списке
                    if (prevApps.some(app => app._id === newVolunteer._id)) {
                        return prevApps;
                    }
                    return [...prevApps, newVolunteer];
                });
            }
        });
        
        // Обработчик для новых добавленных питомцев
        socketRef.current.on('newPet', (newPet) => {
            // Проверяем, относится ли заявка к текущему пользователю
            if (newPet.email === user.email) {
                setPetSubmissions(prevSubmissions => {
                    // Проверяем, нет ли уже такого питомца в списке
                    if (prevSubmissions.some(pet => pet._id === newPet._id)) {
                        return prevSubmissions;
                    }
                    return [...prevSubmissions, newPet];
                });
            }
        });
        
        // Обработчик для новых пожертвований
        socketRef.current.on('newDonation', (newDonation) => {
            console.log('Получено событие о новом пожертвовании через WebSocket:', newDonation);
            
            // Проверяем, относится ли пожертвование к текущему пользователю
            // Событие содержит user_id или email, нужно проверить
            if (user._id && newDonation.user_id && newDonation.user_id.toString() === user._id.toString()) {
                // Обновляем список пожертвований
                fetchDonations().then(() => {
                    // Отмечаем новое пожертвование
                    if (newDonation._id) {
                        setRecentlyUpdatedDonations(prev => ({
                            ...prev,
                            [newDonation._id]: true
                        }));
                        
                        // Через 5 секунд снимаем отметку
                        setTimeout(() => {
                            setRecentlyUpdatedDonations(prev => ({
                                ...prev,
                                [newDonation._id]: false
                            }));
                        }, 5000);
                    }
                });
                
                // Показываем уведомление
                if (Notification.permission === 'granted') {
                    const notification = new Notification('Новое пожертвование', {
                        body: `Ваше пожертвование на сумму ${newDonation.amount} ${newDonation.currency || 'BYN'} успешно обработано`,
                        icon: '/favicon.ico'
                    });
                    
                    notification.onclick = () => {
                        window.focus();
                        setActiveSection('donations');
                    };
                }
                
                // Если пользователь не находится в разделе пожертвований, показываем уведомление
                if (activeSection !== 'donations') {
                    const successMessage = `Ваше пожертвование на сумму ${newDonation.amount} ${newDonation.currency || 'BYN'} успешно обработано`;
                    setSuccMessage(successMessage);
                    setTimeout(() => setSuccMessage(""), 5000);
                }
            }
        });
        
        // Обработчик для удаленных заявок на усыновление
        socketRef.current.on('formDeleted', ({ id }) => {
            setApplications(prevApps => {
                return prevApps.filter(app => app._id !== id);
            });
        });
        
        // Обработчик для удаленных заявок на волонтерство
        socketRef.current.on('volunteerDeleted', ({ id }) => {
            setVolunteerApplications(prevApps => {
                return prevApps.filter(app => app._id !== id);
            });
        });
        
        // Обработчик для удаленных питомцев
        socketRef.current.on('petDeleted', ({ id }) => {
            // Проверяем, есть ли у пользователя такой питомец
            const deletedPet = petSubmissions.find(pet => pet._id === id);
            
            // Удаляем питомца из списка
            setPetSubmissions(prevSubmissions => {
                const newSubmissions = prevSubmissions.filter(pet => pet._id !== id);
                return newSubmissions;
            });
            
            // Если нашли удаленного питомца, показываем уведомление
            if (deletedPet) {
                // Показываем уведомление, если разрешено
                if (Notification.permission === 'granted') {
                    const notification = new Notification('Питомец был удален', {
                        body: `Животное ${deletedPet.name} было удалено из системы.`,
                        icon: '/favicon.ico'
                    });
                    
                    notification.onclick = () => {
                        window.focus();
                        setActiveSection('petSubmissions');
                    };
                }
                
                // Показываем уведомление на странице, если пользователь не в разделе питомцев
                if (activeSection !== 'petSubmissions') {
                    const successMessage = `Питомец ${deletedPet.name} был удален из системы.`;
                    setSuccMessage(successMessage);
                    setTimeout(() => setSuccMessage(""), 5000);
                }
            }
        });
        
        // Обработчик для обновления заявок (используется в deleteOtherRequests)
        socketRef.current.on('application_updated', (applicationData) => {
            if (applicationData.email === user.email) {
                // Обновляем список заявок
                setApplications(prevApps => {
                    return prevApps.map(app => {
                        if (app._id === applicationData._id) {
                            // Отмечаем что эта заявка была недавно обновлена
                            setRecentlyUpdatedApps(prev => ({
                                ...prev,
                                [applicationData._id]: true
                            }));

                            // Через 5 секунд снимаем отметку
                            setTimeout(() => {
                                setRecentlyUpdatedApps(prev => ({
                                    ...prev,
                                    [applicationData._id]: false
                                }));
                            }, 5000);
                            
                            return {
                                ...app,
                                ...applicationData,
                                statusChanged: true
                            };
                        }
                        return app;
                    });
                });
                
                // Показываем уведомление если пользователь не на странице заявок
                if (Notification.permission === 'granted' && activeSection !== 'applications') {
                    const statusText = translateStatus(applicationData.status);
                    const notification = new Notification('Обновление статуса заявки', {
                        body: `Статус вашей заявки изменен на: ${statusText}`,
                        icon: '/favicon.ico'
                    });
                    
                    notification.onclick = () => {
                        window.focus();
                        setActiveSection('applications');
                    };
                }
            }
        });
        
        // Обработка ошибок соединения
        socketRef.current.on('connect_error', (error) => {
            console.error('Ошибка подключения WebSocket:', error);
        });
        
        // Добавляем обработчик обновлений приютов
        socketRef.current.on('shelterUpdate', (updatedShelter) => {
            // Обновляем информацию о приюте в волонтерских заявках
            setVolunteerApplications(prevApps => {
                return prevApps.map(app => {
                    if (app.shelter_id === updatedShelter._id) {
                        // Отмечаем что эта заявка была недавно обновлена из-за изменений в приюте
                        setRecentlyUpdatedVolunteerApps(prev => ({
                            ...prev,
                            [app._id]: true
                        }));

                        // Через 5 секунд снимаем отметку
                        setTimeout(() => {
                            setRecentlyUpdatedVolunteerApps(prev => ({
                                ...prev,
                                [app._id]: false
                            }));
                        }, 5000);
                        
                        return {
                            ...app,
                            shelter_name: updatedShelter.name,
                            shelter_city: updatedShelter.city || null,
                            shelter_address: updatedShelter.street && updatedShelter.house 
                                ? `${updatedShelter.street}, ${updatedShelter.house}` 
                                : null,
                            shelterDetails: updatedShelter
                        };
                    }
                    return app;
                });
            });
            
            // Обновляем информацию о приюте в заявках на усыновление
            setApplications(prevApps => {
                return prevApps.map(app => {
                    if (app.petDetails && app.petDetails.shelter_id === updatedShelter._id) {
                        return {
                            ...app,
                            petDetails: {
                                ...app.petDetails,
                                shelterDetails: updatedShelter,
                                shelter_name: updatedShelter.name,
                                shelter_city: updatedShelter.city || null,
                                shelter_address: updatedShelter.street && updatedShelter.house 
                                    ? `${updatedShelter.street}, ${updatedShelter.house}` 
                                    : null,
                                shelter_phone: updatedShelter.phone || null,
                                shelter_email: updatedShelter.email || null
                            }
                        };
                    }
                    return app;
                });
            });
        });
        
        // Добавляем обработчик обновлений предпочтений пользователя
        socketRef.current.on('userPreferencesUpdated', (updatedPreferences) => {
            // Dispatch a custom event that PreferencesFromChat can listen to
            window.dispatchEvent(new CustomEvent('ai:prefs-updated', { detail: updatedPreferences }));
        });

        // Добавляем обработчики для избранного
        socketRef.current.on('favoriteAdded', (data) => {
            if (data.user_id === user._id || data.user_id === user._id?.toString()) {
                setRecentlyUpdatedFavorites(prev => ({
                    ...prev,
                    [data._id]: true
                }));
                setTimeout(() => {
                    setRecentlyUpdatedFavorites(prev => {
                        const newState = { ...prev };
                        delete newState[data._id];
                        return newState;
                    });
                }, 3000);
                // Обновляем счетчик избранного
                fetchFavoritesCount();
            }
        });

        socketRef.current.on('favoriteRemoved', (data) => {
            if (data.user_id === user._id || data.user_id === user._id?.toString()) {
                // Обновляем счетчик избранного
                fetchFavoritesCount();
            }
        });
        
        // Очистка при размонтировании компонента
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, [user, activeSection]);

    // При первой загрузке запрашиваем разрешение на показ уведомлений
    useEffect(() => {
        if (Notification && Notification.permission !== "granted") {
            Notification.requestPermission();
        }
    }, []);

    // Объединяем два useEffect для загрузки заявок в один, исключая fetchApplications из зависимостей
    useEffect(() => {
        if (!user) return;
        
        // Always load applications initially to get the correct count
        // and also when switching to applications tab
        fetchApplications();
        fetchVolunteerApplications();
        fetchPetSubmissions();
        fetchDonations();
        fetchCalendars();
        fetchFavoritesCount();
        
    }, [user, fetchApplications, fetchVolunteerApplications, fetchPetSubmissions, fetchDonations, fetchCalendars, fetchFavoritesCount]); // Remove activeSection dependency
    
    // Separate effect for refreshing data when switching to a specific tab
    useEffect(() => {
        if (!user) return;
        
        // Refresh data based on active section
        if (activeSection === 'applications') {
            fetchApplications();
        } else if (activeSection === 'volunteer') {
            fetchVolunteerApplications();
        } else if (activeSection === 'petSubmissions') {
            fetchPetSubmissions();
        } else if (activeSection === 'donations') {
            fetchDonations();
        } else if (activeSection === 'petCare') {
            fetchCalendars();
        } else if (activeSection === 'favorites') {
            fetchFavoritesCount();
        }
    }, [activeSection, fetchApplications, fetchVolunteerApplications, fetchPetSubmissions, fetchDonations, fetchCalendars, fetchFavoritesCount, user]);

    const validateName = (name) => {
        if (!name) {
            return 'Имя обязательно для заполнения';
        }
        if (name.length < 3) {
            return 'Имя должно содержать не менее 3 символов';
        }
        if (name.length > 30) {
            return 'Имя должно содержать не более 30 символов';
        }
        if (!/^[a-zA-Zа-яА-Я0-9\s]+$/.test(name)) {
            return 'Имя может содержать только буквы, цифры и пробелы';
        }
        return null;
    };

    // Если пользователь не авторизован, показываем встроенный блок авторизации на странице
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
                    <p>Вам необходимо войти в систему для просмотра своего профиля.</p>
                    <p>Пожалуйста, войдите или создайте аккаунт для доступа к этой странице.</p>
                    <div className="auth-actions">
                        <Link to="/pawfinds/auth" className="auth-button primary">Войти / Зарегистрироваться</Link>
                    </div>
                </div>
            </div>
        );
    }

    const handleChange = (e) => {
        // Разрешаем изменять только имя, email остается неизменным
        if (e.target.name !== 'email') {
            setTempValues({ ...tempValues, [e.target.name]: e.target.value });
        }
    };

    const handleSave = async () => {
        setErrors([]);
        setSuccMessage("");

        // Валидируем имя перед отправкой
        const nameError = validateName(tempValues.name);
        if (nameError) {
            setErrors([{message: nameError}]); // Обратите внимание на формат - массив объектов с ключом message
            return; // Прерываем выполнение, если имя невалидно
        }

        try {
            const response = await fetch('/api/user/update', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${user.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: tempValues.name,
                    email: user.email, // Отправляем текущий email только для идентификации пользователя
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setErrors([{message: data.error}]); // Обновляем формат ошибок
                setIsEditing(true); // Оставляем режим редактирования активным при ошибке
            } else {
                setSuccMessage("Имя успешно обновлено");
                setEditValues({ name: data.updatedUser.name, email: data.updatedUser.email });
                setIsEditing(false);

                // Обновляем контекст с новым именем, но email остается тем же
                dispatch({ type: 'LOGIN', payload: { ...user, userName: data.updatedUser.name } });

                sessionStorage.setItem('user', JSON.stringify({ ...user, userName: data.updatedUser.name }));
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            setErrors([{message: 'Не удалось обновить имя. Пожалуйста, попробуйте позже.'}]); // Обновляем формат ошибок
            setIsEditing(true); // Оставляем режим редактирования активным при ошибке
        }
    };

    const handleEditClick = () => {
        setTempValues({ name: editValues.name }); // Копируем только имя
        setIsEditing(true);
        setSuccMessage("");
    };

    // Функция для переключения между секциями профиля
    const handleSectionChange = (section) => {
        setActiveSection(section);
    };

    const handleDeleteAccount = async () => {
        if (needsPassword) {
            if (!deletePassword) {
                setDeleteError('Введите пароль для подтверждения');
                return;
            }
        } else if (!deleteConfirmEmail) {
            setDeleteError('Введите ваш email для подтверждения');
            return;
        }
        setDeleteLoading(true);
        setDeleteError('');
        try {
            const response = await fetch('/api/user/delete', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${user.token}`
                },
                body: JSON.stringify(
                    needsPassword
                        ? { password: deletePassword }
                        : { confirmEmail: deleteConfirmEmail.trim() }
                )
            });
            const data = await response.json();
            if (!response.ok) {
                setDeleteError(data.error || 'Ошибка при удалении аккаунта');
                return;
            }
            sessionStorage.removeItem('user');
            sessionStorage.removeItem('token');
            dispatch({ type: 'LOGOUT' });
            window.location.href = '/';
        } catch (err) {
            setDeleteError('Ошибка сети. Попробуйте позже.');
        } finally {
            setDeleteLoading(false);
        }
    };

    return (
        <>
        <div className="profile-new-page">
            <div className="profile-sidebar">
                <div className="user-info">
                    <div className="avatar">
                        <div className="avatar-letter">{editValues.name.charAt(0).toUpperCase()}</div>
                    </div>
                    <h2 className="user-name">{editValues.name}</h2>
                    <p className="user-email">{editValues.email}</p>
                    <div className="account-status">
                        <span className="status-indicator"></span>
                        Активный аккаунт
                    </div>
                </div>
                
                <div className="profile-menu">
                    <button 
                        className={`menu-item ${activeSection === 'applications' ? 'active' : ''}`}
                        onClick={() => handleSectionChange('applications')}
                    >
                        <span className="icon" aria-hidden><IconAdoptionApps /></span> Мои заявки на усыновление
                        {loading ? (
                            <span className="badge loading-badge">...</span>
                        ) : applications.length > 0 && (
                            <span className="badge">{applications.length}</span>
                        )}
                    </button>
                    <button 
                        className={`menu-item ${activeSection === 'volunteer' ? 'active' : ''}`}
                        onClick={() => handleSectionChange('volunteer')}
                    >
                        <span className="icon" aria-hidden><IconVolunteer /></span> Волонтерство 
                        {volunteerLoading ? (
                            <span className="badge loading-badge">...</span>
                        ) : volunteerApplications.length > 0 && (
                            <span className="badge">{volunteerApplications.length}</span>
                        )}
                    </button>
                    <button 
                        className={`menu-item ${activeSection === 'petSubmissions' ? 'active' : ''}`}
                        onClick={() => handleSectionChange('petSubmissions')}
                    >
                        <span className="icon" aria-hidden><IconHousePets /></span> Мои питомцы 
                        {petsLoading ? (
                            <span className="badge loading-badge">...</span>
                        ) : petSubmissions.length > 0 && (
                            <span className="badge">{petSubmissions.length}</span>
                        )}
                    </button>
                    <button 
                        className={`menu-item ${activeSection === 'petCare' ? 'active' : ''}`}
                        onClick={() => handleSectionChange('petCare')}
                    >
                        <span className="icon" aria-hidden><IconCalendarCare /></span> Календарь ухода
                        {allAdoptedPets.length > 0 && (
                            <span className="badge">{allAdoptedPets.length}</span>
                        )}
                    </button>
                    <button 
                        className={`menu-item ${activeSection === 'donations' ? 'active' : ''}`}
                        onClick={() => handleSectionChange('donations')}
                    >
                        <span className="icon" aria-hidden><IconDonationHeart /></span> История пожертвований
                        {donationsLoading ? (
                            <span className="badge loading-badge">...</span>
                        ) : donations.length > 0 && (
                            <span className="badge">{donations.length}</span>
                        )}
                    </button>
                    <button 
                        className={`menu-item ${activeSection === 'favorites' ? 'active' : ''}`}
                        onClick={() => handleSectionChange('favorites')}
                    >
                        <span className="icon" aria-hidden><IconStarFavorite /></span> Избранное
                        {favoritesCount > 0 && (
                            <span className="badge">{favoritesCount}</span>
                        )}
                    </button>
                    <button 
                        className={`menu-item ${activeSection === 'profile' ? 'active' : ''}`} 
                        onClick={() => handleSectionChange('profile')}
                    >
                        <span className="icon" aria-hidden><IconUserProfile /></span> Мой профиль
                    </button>
                    <button 
                        className={`menu-item ${activeSection === 'preferences' ? 'active' : ''}`}
                        onClick={() => handleSectionChange('preferences')}
                    >
                        <span className="icon" aria-hidden><IconPreferences /></span> Мои предпочтения
                    </button>
                {!isEditing ? (
                        <button onClick={handleEditClick} className="edit-profile-btn">
                            <span className="icon" aria-hidden><IconPencilEdit /></span> Редактировать
                        </button>
                ) : (
                        <button onClick={handleSave} className="save-profile-btn">
                            <span className="icon" aria-hidden><IconSave /></span> Сохранить
                        </button>
                )}
                </div>
                
                <div className="account-security">
                    <p>Для смены пароля воспользуйтесь опцией "Забыли пароль" на странице входа</p>
                </div>
            </div>
            
            <div className="profile-main-content">
                {activeSection === 'profile' && (
                    <div className="content-section profile-section">
                        <h1>Мой профиль</h1>
                        
                        <div className="profile-details">
                    {isEditing ? (
                                <div className="edit-form">
                                    <div className="form-group">
                                        <label>Имя</label>
                        <input
                            type="text"
                            name="name"
                            value={tempValues.name}
                            onChange={handleChange}
                            placeholder="Ваше имя"
                            className="profile-input"
                            maxLength={30}
                            minLength={3}
                        />
                </div>
                                    
                                    <div className="form-group">
                                        <label>Email</label>
                        <input
                            type="email"
                            name="email"
                            value={editValues.email}
                            placeholder="Ваш email"
                            className="profile-input"
                            readOnly
                            disabled
                            style={{backgroundColor: '#f5f5f5', cursor: 'not-allowed'}}
                        />
                        <small style={{color: '#666', fontSize: '14px'}}>Email нельзя изменить</small>
                </div>
            </div>
                            ) : (
                                <div className="info-card">
                                    <div className="info-row">
                                        <span className="info-label">Имя:</span>
                                        <span className="info-value">{editValues.name}</span>
                                    </div>
                                    <div className="info-row">
                                        <span className="info-label">Email:</span>
                                        <span className="info-value">{editValues.email}</span>
            </div>

                </div>
            )}
                            
                            {succMessage && <div className="success-alert">{succMessage}</div>}

                            {errors.length > 0 && (
                                <div className="error-alert">
                    {errors.map((error, index) => (
                                        <p key={index}>{error.message}</p>
                                    ))}
                                </div>
                            )}

                            <div className="delete-account-section">
                                <button
                                    className="delete-account-btn"
                                    onClick={() => { setShowDeleteModal(true); setDeletePassword(''); setDeleteError(''); }}
                                >
                                    Удалить аккаунт
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                
                {activeSection === 'preferences' && (
                    <div className="content-section profile-section">
                        {/** Заменяем анкету на автообновляемые предпочтения из чата **/}
                        <PreferencesFromChat />
                    </div>
                )}
                
                {activeSection === 'petCare' && (
                    <div className="content-section profile-section">
                        <h1> Календарь ухода за питомцами</h1>
                        {allAdoptedPets.length === 0 ? (
                            <div className="no-pets-message">
                                <p>У вас пока нет усыновленных питомцев.</p>
                                <p>Календарь ухода станет доступен после одобрения вашей заявки на усыновление питомца.</p>
                                <p style={{marginTop: '10px', fontSize: '14px', color: '#888'}}>
                                    Обратите внимание: календарь доступен только для питомцев, заявки на усыновление которых были одобрены администратором.
                                </p>
                            </div>
                        ) : (
                            <div className="pet-care-calendars">
                                {allAdoptedPets.length > 1 && (
                                    <div className="pet-selector">
                                        <label htmlFor="pet-select">Выберите питомца:</label>
                                        <StyledSelect
                                            id="pet-select"
                                            value={selectedPetId || ''}
                                            onChange={(v) => setSelectedPetId(v)}
                                            options={allAdoptedPets.map((pet) => ({
                                                value: String(pet._id),
                                                label: pet.name
                                            }))}
                                            aria-label="Выберите питомца"
                                        />
                                    </div>
                                )}
                                {selectedPetId && allAdoptedPets.find(p => p._id === selectedPetId) && (
                                    <div className="pet-calendar-wrapper">
                                        <PetCareCalendar 
                                            key={selectedPetId}
                                            petId={selectedPetId} 
                                            petName={allAdoptedPets.find(p => p._id === selectedPetId).name}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
                
                {activeSection === 'applications' && (
                    <AdoptionApplications 
                        applications={applications}
                        loading={loading}
                        recentlyUpdatedApps={recentlyUpdatedApps}
                    />
                )}
                
                {activeSection === 'volunteer' && (
                    <VolunteerApplications 
                        applications={volunteerApplications}
                        loading={volunteerLoading}
                        recentlyUpdatedApps={recentlyUpdatedVolunteerApps}
                    />
                )}
                
                {activeSection === 'petSubmissions' && (
                    <UserPetSubmissions 
                        submissions={petSubmissions}
                        loading={petsLoading}
                        recentlyUpdatedSubmissions={recentlyUpdatedPetSubmissions}
                    />
                )}
                
                {activeSection === 'donations' && (
                    <DonationHistory 
                        donations={donations}
                        loading={donationsLoading}
                        recentlyUpdatedDonations={recentlyUpdatedDonations}
                    />
                )}
                
                {activeSection === 'favorites' && (
                    <FavoritePets 
                        loading={false}
                        recentlyUpdatedFavorites={recentlyUpdatedFavorites}
                    />
                )}
            </div>
        </div>

        {showDeleteModal && (
            <div className="modal-overlay" style={{ zIndex: 9999 }}>
                <div className="modal" style={{ maxWidth: '440px', padding: '32px' }}>
                    <div className="modal-header">
                        <h2 style={{ color: '#d32f2f' }}>Удалить аккаунт</h2>
                        <button className="close-modal" onClick={() => setShowDeleteModal(false)}>×</button>
                    </div>
                    <div className="modal-content">
                        <p style={{ marginBottom: '16px', color: '#555' }}>
                            Это действие <strong>необратимо</strong>. Будут удалены все ваши данные: заявки, волонтёрские заявки, избранное, история ухода за питомцами.
                        </p>
                        <div className="form-group">
                            {needsPassword ? (
                                <>
                                    <label>Введите пароль для подтверждения:</label>
                                    <input
                                        type="password"
                                        value={deletePassword}
                                        onChange={(e) => setDeletePassword(e.target.value)}
                                        placeholder="Ваш пароль"
                                        className="profile-input"
                                        style={{ marginTop: '8px' }}
                                        onKeyDown={(e) => e.key === 'Enter' && handleDeleteAccount()}
                                    />
                                </>
                            ) : (
                                <>
                                    <label>Введите ваш email для подтверждения:</label>
                                    <input
                                        type="email"
                                        value={deleteConfirmEmail}
                                        onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                                        placeholder={user?.email || 'your@email.com'}
                                        className="profile-input"
                                        style={{ marginTop: '8px' }}
                                        onKeyDown={(e) => e.key === 'Enter' && handleDeleteAccount()}
                                    />
                                </>
                            )}
                        </div>
                        {deleteError && (
                            <div className="error-alert" style={{ marginTop: '8px' }}>
                                <p>{deleteError}</p>
                            </div>
                        )}
                        <div className="confirmation-actions" style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button className="cancel-btn" onClick={() => setShowDeleteModal(false)}>
                                Отмена
                            </button>
                            <button
                                className="delete-account-confirm-btn"
                                onClick={handleDeleteAccount}
                                disabled={deleteLoading}
                            >
                                {deleteLoading ? 'Удаление...' : 'Удалить аккаунт'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

export default Profile;