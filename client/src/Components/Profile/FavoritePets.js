import React, { useState, useEffect, useRef } from 'react';
import { useAuthContext } from '../../hooks/UseAuthContext';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { getSocketServerUrl } from '../../utils/socketServerUrl';
import { getPetImageUrl } from '../../utils/petImageUrl';
import './FavoritePets.css';

const FavoritePets = ({ loading: externalLoading, recentlyUpdatedFavorites }) => {
    const { user } = useAuthContext();
    const navigate = useNavigate();
    const [favorites, setFavorites] = useState([]);
    const [favoritesLoading, setFavoritesLoading] = useState(true);
    const socketRef = useRef(null);

    // Загрузка избранных питомцев
    const fetchFavorites = async () => {
        if (!user || !user.token) return;

        try {
            setFavoritesLoading(true);
            const response = await fetch('/api/favorites', {
                headers: { 'Authorization': `Bearer ${user.token}` }
            });

            if (!response.ok) {
                throw new Error('Не удалось загрузить избранное');
            }

            const data = await response.json();
            setFavorites(data.favorites || []);
        } catch (error) {
            console.error('Ошибка загрузки избранного:', error);
        } finally {
            setFavoritesLoading(false);
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
            if (data.user_id === user._id || data.user_id === user._id?.toString()) {
                // Обновляем список избранного
                fetchFavorites();
            }
        });

        socketRef.current.on('favoriteRemoved', (data) => {
            if (data.user_id === user._id || data.user_id === user._id?.toString()) {
                // Удаляем питомца из списка
                setFavorites(prev => prev.filter(fav => fav.pet && fav.pet._id !== data.pet_id && fav.pet._id?.toString() !== data.pet_id));
            }
        });

        // Обновляем список при изменении статуса питомца
        socketRef.current.on('petRequestUpdate', (updatedPet) => {
            setFavorites(prev => prev.map(fav => 
                fav.pet._id === updatedPet._id 
                    ? { ...fav, pet: updatedPet }
                    : fav
            ));
        });

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, [user]);

    useEffect(() => {
        fetchFavorites();
    }, [user]);

    // Удаление из избранного
    const handleRemoveFavorite = async (petId) => {
        if (!user || !user.token) return;

        try {
            const response = await fetch(`/api/favorites/${petId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${user.token}` }
            });

            if (response.ok) {
                setFavorites(prev => prev.filter(fav => fav.pet._id !== petId));
            } else {
                const errorData = await response.json();
                alert(errorData.error || 'Ошибка при удалении из избранного');
            }
        } catch (error) {
            console.error('Ошибка удаления из избранного:', error);
            alert('Произошла ошибка');
        }
    };

    // Форматирование даты
    const formatDate = (dateString) => {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('ru-RU', options);
    };

    // Форматирование возраста
    const formatAge = (birthDate) => {
        if (!birthDate) return 'Не указан';
        const birth = new Date(birthDate);
        const today = new Date();
        const years = today.getFullYear() - birth.getFullYear();
        const months = today.getMonth() - birth.getMonth();
        
        if (years === 0) {
            return `${months} ${months === 1 ? 'месяц' : months < 5 ? 'месяца' : 'месяцев'}`;
        }
        return `${years} ${years === 1 ? 'год' : years < 5 ? 'года' : 'лет'}`;
    };

    if (externalLoading || favoritesLoading) {
        return (
            <div className="content-section applications-section">
                <h1>Избранные питомцы</h1>
                <div className="loading-indicator">Загрузка избранных питомцев...</div>
            </div>
        );
    }

    if (favorites.length === 0) {
        return (
            <div className="content-section applications-section">
                <h1>Избранные питомцы</h1>
                <div className="donation-empty-state">
                    <div className="donation-empty-icon"></div>
                    <h3>У вас пока нет избранных питомцев</h3>
                    <p>Добавляйте понравившихся питомцев в избранное, чтобы не потерять их!</p>
                </div>
            </div>
        );
    }

    return (
        <div className="content-section applications-section">
            <h1>Избранные питомцы</h1>
            
            <div className="favorites-grid">
                {favorites.map((favorite) => {
                    const pet = favorite.pet;
                    if (!pet) return null;
                    const isAdopted = pet.status === 'Adopted';

                    return (
                        <div 
                            key={favorite._id} 
                            className={`favorite-pet-card ${recentlyUpdatedFavorites[favorite._id] ? 'status-just-updated' : ''}`}
                        >
                            <div className="favorite-pet-image-container">
                                <img 
                                    src={getPetImageUrl(pet.filename)}
                                    alt={pet.name}
                                    onClick={() => navigate(`/pawfinds/adopt-form/${pet._id}`)}
                                    onError={(e) => {
                                        e.target.src = "/api/images/default.jpg";
                                    }}
                                />
                                <button
                                    className="remove-favorite-btn"
                                    onClick={() => handleRemoveFavorite(pet._id)}
                                    title="Удалить из избранного"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                    </svg>
                                </button>
                            </div>
                            
                            <div className="favorite-pet-info">
                                <h3 onClick={() => navigate(`/pawfinds/adopt-form/${pet._id}`)}>{pet.name}</h3>
                                <div className="favorite-pet-details">
                                    <span>{pet.species}</span>
                                    {pet.breed && <span>• {pet.breed}</span>}
                                    {pet.birthDate && <span>• {formatAge(pet.birthDate)}</span>}
                                </div>
                                
                                {pet.area && (
                                    <div className="favorite-pet-location">
                                        📍 {pet.area}
                                    </div>
                                )}

                                <div className="favorite-pet-status">
                                    {pet.status === 'Approved' ? (
                                        <span className="status-badge status-approved">Доступен</span>
                                    ) : pet.status === 'Adopted' ? (
                                        <span className="status-badge status-adopted">Усыновлен</span>
                                    ) : (
                                        <span className="status-badge status-pending">На рассмотрении</span>
                                    )}
                                </div>

                                <div className="favorite-pet-actions">
                                    <button
                                        className="view-pet-btn"
                                        onClick={() => navigate(`/pawfinds/adopt-form/${pet._id}`)}
                                    >
                                        {isAdopted ? 'Просмотр' : 'Подробнее'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default FavoritePets;
