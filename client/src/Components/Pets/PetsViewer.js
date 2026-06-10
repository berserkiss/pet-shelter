import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, isValid } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAuthContext } from "../../hooks/UseAuthContext";
import { useAuthModal } from '../../Context/AuthModalContext';
import { formatAge } from '../../utils/ageFormatter';
import io from 'socket.io-client';
import { getSocketServerUrl } from '../../utils/socketServerUrl';
import { getPetImageUrl, handlePetImageError } from '../../utils/petImageUrl';
import AIRobotIcon from '../icons/AIRobotIcon';
import './PetCard.css';

const traitLabels = {
    species: 'Вид',
    breed: 'Порода',
    size: 'Размер',
    activityLevel: 'Активность',
    careLevel: 'Забота',
    temperament: 'Темперамент',
    location: 'Локация',
    kidFriendly: 'Подходит детям',
    petFriendly: 'Подходит другим питомцам',
    allergyFriendly: 'Гипоаллергенный'
};

const sizeLabels = {
    small: 'Маленький',
    medium: 'Средний',
    large: 'Крупный',
    giant: 'Очень крупный'
};

const levelLabels = {
    low: 'Низкий',
    medium: 'Средний',
    high: 'Высокий'
};

const activityLabels = {
    low: 'Низкая',
    moderate: 'Средняя',
    high: 'Высокая'
};

const PetsViewer = ({ pet, shelter, shelterAddress, matchPercentage, matchedTraits, aiReasoning }) => {
    const navigate = useNavigate();
    const { user } = useAuthContext();
    const { showAuthModal } = useAuthModal();
    const [isFavorite, setIsFavorite] = useState(false);
    const [favoriteLoading, setFavoriteLoading] = useState(false);
    const socketRef = useRef(null);

    // Проверка статуса избранного при загрузке
    useEffect(() => {
        if (user && user.token && pet._id) {
            checkFavoriteStatus();
            
            // Инициализация WebSocket
            socketRef.current = io(getSocketServerUrl(), {
                path: '/socket.io',
                auth: {
                    token: user.token
                }
            });

            socketRef.current.on('favoriteAdded', (data) => {
                if (data.pet_id === pet._id || data.pet_id === pet._id?.toString()) {
                    if (data.user_id === user._id || data.user_id === user._id?.toString()) {
                        setIsFavorite(true);
                    }
                }
            });

            socketRef.current.on('favoriteRemoved', (data) => {
                if (data.pet_id === pet._id || data.pet_id === pet._id?.toString()) {
                    if (data.user_id === user._id || data.user_id === user._id?.toString()) {
                        setIsFavorite(false);
                    }
                }
            });

            return () => {
                if (socketRef.current) {
                    socketRef.current.disconnect();
                }
            };
        }
    }, [user, pet._id]);

    const checkFavoriteStatus = async () => {
        if (!user || !user.token || !pet._id) return;
        
        try {
            const response = await fetch(`/api/favorites/check/${pet._id}`, {
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

    const handleToggleFavorite = async (e) => {
        e.stopPropagation();
        
        if (!user || !user.token) {
            showAuthModal('добавить питомца в избранное');
            return;
        }

        setFavoriteLoading(true);
        
        try {
            if (isFavorite) {
                // Удаляем из избранного
                const response = await fetch(`/api/favorites/${pet._id}`, {
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
                    body: JSON.stringify({ pet_id: pet._id })
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

    const formatTimeAgo = (value) => {
        if (value == null || value === '') {
            return 'недавно';
        }
        const date = value instanceof Date ? value : new Date(value);
        if (!isValid(date)) {
            return 'недавно';
        }
        try {
            return formatDistanceToNow(date, { addSuffix: true, locale: ru });
        } catch {
            return 'недавно';
        }
    };

    const handleShowInterest = () => {
        if (!user) {
            showAuthModal('проявить интерес к этому питомцу');
            return;
        }
        
        console.log("Перенаправление на страницу питомца с ID:", pet._id);
        navigate(`/pawfinds/adopt-form/${pet._id}`);
    };

    return (
        <article className="pet-view-card">
            <div className="pet-card-media">
                {typeof matchPercentage === 'number' && (
                    <span className="match-badge">Совпадение {matchPercentage}%</span>
                )}
                <div className="pet-image-wrapper">
                <img 
                    src={getPetImageUrl(pet.filename)} 
                    alt={pet.name} 
                    onError={handlePetImageError}
                    />
                    {user && (
                        <button 
                            className={`favorite-overlay-btn ${isFavorite ? 'favorite-active' : ''}`}
                            onClick={handleToggleFavorite}
                            disabled={favoriteLoading}
                            title={isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
                        >
                            {favoriteLoading ? (
                                <span className="favorite-loading">...</span>
                            ) : (
                                <svg width="24" height="24" viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                </svg>
                            )}
                        </button>
                    )}
                </div>
            </div>

            <div className="pet-card-body">
                <header className="pet-card-header">
                    <h3 className="pet-card-title">{pet.name}</h3>
                    <span className="pet-card-updated">Обновлено {formatTimeAgo(pet.updatedAt ?? pet.createdAt)}</span>
                </header>

                <div className="pet-meta-grid">
                    {pet.species && (
                        <div className="pet-meta-item">
                            <span className="meta-label">Вид</span>
                            <span className="meta-value">{pet.species}</span>
                        </div>
                    )}
                    {pet.breed && (
                        <div className="pet-meta-item">
                            <span className="meta-label">Порода</span>
                            <span className="meta-value">{pet.breed}</span>
                        </div>
                    )}
                    <div className="pet-meta-item">
                        <span className="meta-label">Возраст</span>
                        <span className="meta-value">{formatAge(pet.birthDate)}</span>
                    </div>
                    <div className="pet-meta-item">
                        <span className="meta-label">Локация</span>
                        <span className="meta-value">{shelterAddress || pet.area || '—'}</span>
                    </div>
                </div>

                {aiReasoning && (
                    <div className="pet-ai-reasoning">
                        <span className="ai-reasoning-icon" aria-hidden="true">
                            <AIRobotIcon size={18} decorative />
                        </span>
                        <span className="ai-reasoning-text">{aiReasoning}</span>
                    </div>
                )}

                {pet.description ? (
                    <p className="pet-description">{pet.description}</p>
                ) : (
                    <p className="pet-description" style={{ fontStyle: 'italic', color: '#9ca3af' }}>
                        Описание отсутствует
                    </p>
                )}

                <div className="pet-attributes">
                    {pet.size && (
                        <span className="pet-attribute-chip">
                            Размер: {sizeLabels[pet.size] || pet.size}
                        </span>
                    )}
                    {pet.energyLevel && (
                        <span className="pet-attribute-chip">
                            Энергичность: {levelLabels[pet.energyLevel] || pet.energyLevel}
                        </span>
                )}
                    {pet.careLevel && (
                        <span className="pet-attribute-chip">
                            Забота: {levelLabels[pet.careLevel] || pet.careLevel}
                        </span>
                    )}
                    {pet.activityNeeds && (
                        <span className="pet-attribute-chip">
                            Активность: {activityLabels[pet.activityNeeds] || pet.activityNeeds}
                        </span>
                    )}
            </div>

                {(pet.isKidFriendly !== undefined ||
                    pet.isPetFriendly !== undefined ||
                    pet.hypoallergenic) && (
                    <div className="pet-flags">
                        {pet.isKidFriendly !== false && (
                            <span className="pet-flag">Подходит детям</span>
                        )}
                        {pet.isPetFriendly !== false && (
                            <span className="pet-flag">Дружит с животными</span>
                        )}
                        {pet.hypoallergenic && (
                            <span className="pet-flag hypoallergenic">Гипоаллергенный</span>
                        )}
                    </div>
                )}

                {Array.isArray(pet.temperamentTraits) && pet.temperamentTraits.length > 0 && (
                    <div className="pet-temperaments">
                        {pet.temperamentTraits.map((trait) => (
                            <span key={trait} className="pet-temperament-chip">
                                {trait}
                            </span>
                        ))}
                    </div>
                )}

                <footer className="pet-card-footer">
                    <div className="pet-shelter-info">
                        <span className="shelter-label">Приют</span>
                        <span className="shelter-name">
                            {shelter ? shelter.name : 'Информация недоступна'}
                        </span>
                        {shelter?.phone && (
                            <span className="shelter-contact">{shelter.phone}</span>
                        )}
                    </div>
                    <button className="pet-action-button" onClick={handleShowInterest}>
                        Проявить интерес
                        <span className="pet-action-icon">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.703 1.725 1.722 3.656 1 1.261-.472 1.96-1.45 2.344-2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M14.267 5.172c0-1.39 1.577-2.493 3.5-2.172 2.823.47 4.113 6.006 4 7-.08.703-1.725 1.722-3.656 1-1.261-.472-1.855-1.45-2.239-2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M8 14v.5M16 14v.5M11.25 16.25h1.5L12 17l-.75-.75z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M4.42 11.247A13.152 13.152 0 0 0 4 14.556C4 18.728 7.582 21 12 21s8-2.272 8-6.444c0-1.061-.162-2.2-.493-3.309m-9.243-6.082A8.801 8.801 0 0 1 12 5c.78 0 1.5.108 2.161.306" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </span>
                    </button>
                </footer>
            </div>
        </article>
    );
};

export default PetsViewer;