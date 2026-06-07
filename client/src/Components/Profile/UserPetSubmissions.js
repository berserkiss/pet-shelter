import React, { useState } from 'react';
import { formatAge } from '../../utils/ageFormatter';
import { getPetImageUrl } from '../../utils/petImageUrl';

const UserPetSubmissions = ({
    submissions,
    loading,
    recentlyUpdatedSubmissions
}) => {
    const [selectedSubmission, setSelectedSubmission] = useState(null);

    // Формат даты
    const formatDate = (dateString) => {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
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

    // Функция для определения класса highlighting для заявки на добавление питомца
    const getSubmissionHighlightClass = (petId) => {
        return recentlyUpdatedSubmissions[petId] ? "status-just-updated" : "";
    };

    // Статус изменения для заявки на добавление питомца
    const isSubmissionStatusChanged = (petId) => {
        return recentlyUpdatedSubmissions[petId] || false;
    };

    // Обработчик для просмотра заявки на добавление питомца
    const handleViewSubmission = (pet) => {
        setSelectedSubmission(pet);
    };

    // Закрытие детальной информации о заявке
    const handleCloseDetails = () => {
        setSelectedSubmission(null);
    };

    return (
        <div className="content-section applications-section">
            <h1>
                Мои питомцы для усыновления
            </h1>
            
            {loading ? (
                <div className="loading-indicator">Загрузка данных о питомцах...</div>
            ) : selectedSubmission ? (
                <div className="application-details-view">
                    <button className="back-button" onClick={handleCloseDetails}>
                        <span className="icon">←</span> Назад к списку
                    </button>
                    
                    <div className="application-detail-header">
                        <h2>Заявка на размещение питомца</h2>
                        <div className={`app-status status status-${selectedSubmission.status.toLowerCase()} ${isSubmissionStatusChanged(selectedSubmission._id) ? 'status-just-updated' : ''}`}>
                            {translatePetStatus(selectedSubmission.status)}
                            {isSubmissionStatusChanged(selectedSubmission._id) && <span className="status-update-badge">Обновлено</span>}
                        </div>
                    </div>
                    
                    <div className="application-detail-content">
                        <div className="pet-details-column">
                            <h3>Информация о питомце</h3>
                            <div className="pet-detail-image">
                                <img 
                                    src={getPetImageUrl(selectedSubmission.filename)} 
                                    alt={selectedSubmission.name} 
                                    onError={(e) => {
                                        e.target.src = "/api/images/default.jpg";
                                    }}
                                />
                            </div>
                            <div className="pet-info-list">
                                <div className="detail-row">
                                    <span className="detail-label">Имя:</span> 
                                    <span className="detail-value">{selectedSubmission.name}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Вид:</span> 
                                    <span className="detail-value">{selectedSubmission.species}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Порода:</span> 
                                    <span className="detail-value">{selectedSubmission.breed}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Возраст:</span> 
                                    <span className="detail-value">
                                        {selectedSubmission.birthDate 
                                            ? formatAge(selectedSubmission.birthDate)
                                            : "Неизвестно"
                                        }
                                    </span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Описание:</span> 
                                    <span className="detail-value description">{selectedSubmission.description}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="application-info-column">
                            <h3>Информация о заявке</h3>
                            <div className="app-info-list">
                                <div className="detail-row">
                                    <span className="detail-label">Дата подачи:</span> 
                                    <span className="detail-value">{formatDate(selectedSubmission.createdAt)}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Приют:</span> 
                                    <span className="detail-value">
                                        {selectedSubmission.shelterDetails ? selectedSubmission.shelterDetails.name : 'Не указан'}
                                    </span>
                                </div>
                                {selectedSubmission.shelterDetails && (
                                    <div className="detail-row">
                                        <span className="detail-label">Телефон приюта:</span> 
                                        <span className="detail-value">
                                            <a href={`tel:${selectedSubmission.shelterDetails.phone}`}>
                                                {selectedSubmission.shelterDetails.phone}
                                            </a>
                                        </span>
                                    </div>
                                )}
                                <div className="detail-row">
                                    <span className="detail-label">Причина размещения:</span> 
                                    <span className="detail-value description">{selectedSubmission.justification || 'Не указана'}</span>
                                </div>
                                {selectedSubmission.adopter_email && (
                                    <div className="detail-row">
                                        <span className="detail-label">Усыновитель:</span> 
                                        <span className="detail-value">{selectedSubmission.adopter_email}</span>
                                    </div>
                                )}
                            </div>
                            
                            <div className="application-instructions">
                                <h3>Статус заявки</h3>
                                {selectedSubmission.status === "Approved" ? (
                                    <div className="instruction-box approved-instructions">
                                        <p><strong>Питомец размещен на сайте!</strong></p>
                                        <p>Ваш питомец теперь доступен для усыновления. Пользователи могут видеть его в общем каталоге питомцев.</p>
                                        <p>Когда кто-то заинтересуется вашим питомцем, мы свяжемся с вами по указанной контактной информации.</p>
                                    </div>
                                ) : selectedSubmission.status === "Adopted" ? (
                                    <div className="instruction-box approved-instructions">
                                        <p><strong>Поздравляем! Ваш питомец нашел новый дом!</strong></p>
                                        <p>Питомец был успешно усыновлен. Мы надеемся, что он будет счастлив в своем новом доме.</p>
                                        <p>Благодарим вас за использование нашей платформы!</p>
                                    </div>
                                ) : selectedSubmission.status === "Rejected" ? (
                                    <div className="instruction-box rejected-instructions">
                                        <p><strong>К сожалению, ваша заявка была отклонена.</strong></p>
                                        <p>Это могло произойти по различным причинам. Если у вас есть вопросы, пожалуйста, свяжитесь с администрацией сайта.</p>
                                        <p>Вы можете попробовать подать заявку снова, убедившись, что предоставленная информация полная и точная.</p>
                                    </div>
                                ) : selectedSubmission.status === "InReview" ? (
                                    <div className="instruction-box inreview-instructions">
                                        <p>Ваша заявка находится на рассмотрении.</p>
                                        <p>Наша команда проверяет предоставленную информацию. Мы свяжемся с вами при необходимости.</p>
                                        <p>Обычно проверка занимает 1-3 рабочих дня.</p>
                                    </div>
                                ) : (
                                    <div className="instruction-box pending-instructions">
                                        <p>Ваша заявка ожидает рассмотрения.</p>
                                        <p>Мы рассмотрим вашу заявку в ближайшее время.</p>
                                        <p>Обычно этот процесс занимает от 3 до 5 рабочих дней.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : submissions.length > 0 ? (
                <div className="applications-grid">
                    {submissions.map((pet, index) => (
                        <div 
                            key={index} 
                            className={`application-card ${getSubmissionHighlightClass(pet._id)}`} 
                            onClick={() => handleViewSubmission(pet)}
                        >
                            <div className="application-card-header">
                                <div className="pet-image">
                                    <img 
                                        src={getPetImageUrl(pet.filename)} 
                                        alt={pet.name} 
                                        onError={(e) => {
                                            e.target.src = "/api/images/default.jpg";
                                        }}
                                    />
                                </div>
                                <div className={`app-status status-${pet.status.toLowerCase()}`}>
                                    {translatePetStatus(pet.status)}
                                    {isSubmissionStatusChanged(pet._id) && <span className="status-update-badge">Обновлено</span>}
                                </div>
                            </div>
                            <div className="application-card-content">
                                <h3 className="pet-name">{pet.name}</h3>
                                <p className="pet-breed">{pet.breed}</p>
                                <p className="app-date">Размещено: {formatDate(pet.createdAt)}</p>
                                
                                <button className="view-details-btn">
                                    Подробнее
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty-applications">
                    <div className="empty-icon"></div>
                    <h3>У вас пока нет размещенных питомцев</h3>
                    <p>Разместите объявление о питомце, которому нужен новый дом</p>
                    <a href="/pawfinds/services" className="find-pet-btn">Разместить питомца</a>
                </div>
            )}
        </div>
    );
};

export default UserPetSubmissions;

