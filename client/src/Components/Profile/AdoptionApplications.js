import React, { useState } from 'react';
import { formatAge } from '../../utils/ageFormatter';
import { getPetImageUrl } from '../../utils/petImageUrl';

const AdoptionApplications = ({ 
    applications, 
    loading, 
    recentlyUpdatedApps 
}) => {
    const [selectedApplication, setSelectedApplication] = useState(null);

    // Формат даты
    const formatDate = (dateString) => {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    };

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

    // Статус заявки на основе статуса в самой заявке или статуса питомца
    const getApplicationStatus = (application) => {
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
                return "Approved";
            case 'InReview':
                return "InReview";
            case 'Approved':
                return "Approved";
            case 'Pending':
            default:
                return "Pending";
        }
    };

    // Функция для определения класса highlighting для заявки
    const getApplicationHighlightClass = (appId) => {
        return recentlyUpdatedApps[appId] ? "status-just-updated" : "";
    };

    // Статус изменения - проверяем было ли недавнее обновление
    const isStatusChanged = (appId) => {
        return recentlyUpdatedApps[appId] || false;
    };

    // Обработчик для просмотра подробной информации о заявке
    const handleViewApplication = (app) => {
        setSelectedApplication(app);
    };

    // Закрытие детальной информации о заявке
    const handleCloseDetails = () => {
        setSelectedApplication(null);
    };

    return (
        <div className="content-section applications-section">
            <h1>Мои заявки на усыновление</h1>
            
            {loading ? (
                <div className="loading-indicator">Загрузка заявок...</div>
            ) : selectedApplication ? (
                <div className="application-details-view">
                    <button className="back-button" onClick={handleCloseDetails}>
                        <span className="icon">←</span> Назад к списку
                    </button>
                    
                    <div className="application-detail-header">
                        <h2>Заявка на усыновление</h2>
                        <div className={`app-status status status-${getApplicationStatus(selectedApplication).toLowerCase()} ${isStatusChanged(selectedApplication._id) ? 'status-just-updated' : ''}`}>
                            {translateStatus(getApplicationStatus(selectedApplication))}
                            {isStatusChanged(selectedApplication._id) && <span className="status-update-badge">Обновлено</span>}
                        </div>
                    </div>
                    
                    <div className="application-detail-content">
                        <div className="pet-details-column">
                            <h3>Информация о питомце</h3>
                            {selectedApplication.petDetails ? (
                                <>
                                    <div className="pet-detail-image">
                                        <img 
                                            src={getPetImageUrl(selectedApplication.petDetails?.filename)} 
                                            alt={selectedApplication.petDetails.name} 
                                            onError={(e) => {
                                                e.target.src = "/api/images/default.jpg";
                                            }}
                                        />
                                    </div>
                                    <div className="pet-info-list">
                                        <div className="detail-row">
                                            <span className="detail-label">Имя:</span> 
                                            <span className="detail-value">{selectedApplication.petDetails.name}</span>
                                        </div>
                                        <div className="detail-row">
                                            <span className="detail-label">Вид:</span> 
                                            <span className="detail-value">{selectedApplication.petDetails.species}</span>
                                        </div>
                                        <div className="detail-row">
                                            <span className="detail-label">Порода:</span> 
                                            <span className="detail-value">{selectedApplication.petDetails.breed}</span>
                                        </div>
                                        <div className="detail-row">
                                            <span className="detail-label">Возраст:</span> 
                                            <span className="detail-value">
                                                {selectedApplication.petDetails.birthDate 
                                                    ? formatAge(selectedApplication.petDetails.birthDate)
                                                    : "Неизвестно"
                                                }
                                            </span>
                                        </div>
                                        {selectedApplication.petDetails.size && (
                                            <div className="detail-row">
                                                <span className="detail-label">Размер:</span> 
                                                <span className="detail-value">
                                                    {selectedApplication.petDetails.size === 'small' ? 'Маленький' :
                                                     selectedApplication.petDetails.size === 'medium' ? 'Средний' :
                                                     selectedApplication.petDetails.size === 'large' ? 'Большой' :
                                                     selectedApplication.petDetails.size}
                                                </span>
                                            </div>
                                        )}
                                        {selectedApplication.petDetails.energyLevel && (
                                            <div className="detail-row">
                                                <span className="detail-label">Уровень энергии:</span> 
                                                <span className="detail-value">
                                                    {selectedApplication.petDetails.energyLevel === 'low' ? 'Низкий' :
                                                     selectedApplication.petDetails.energyLevel === 'medium' ? 'Средний' :
                                                     selectedApplication.petDetails.energyLevel === 'high' ? 'Высокий' :
                                                     selectedApplication.petDetails.energyLevel}
                                                </span>
                                            </div>
                                        )}
                                        {selectedApplication.petDetails.careLevel && (
                                            <div className="detail-row">
                                                <span className="detail-label">Уровень ухода:</span> 
                                                <span className="detail-value">
                                                    {selectedApplication.petDetails.careLevel === 'low' ? 'Низкий' :
                                                     selectedApplication.petDetails.careLevel === 'medium' ? 'Средний' :
                                                     selectedApplication.petDetails.careLevel === 'high' ? 'Высокий' :
                                                     selectedApplication.petDetails.careLevel}
                                                </span>
                                            </div>
                                        )}
                                        {selectedApplication.petDetails.temperamentTraits && selectedApplication.petDetails.temperamentTraits.length > 0 && (
                                            <div className="detail-row">
                                                <span className="detail-label">Темперамент:</span> 
                                                <span className="detail-value">{selectedApplication.petDetails.temperamentTraits.join(', ')}</span>
                                            </div>
                                        )}
                                        {selectedApplication.petDetails.isKidFriendly !== undefined && (
                                            <div className="detail-row">
                                                <span className="detail-label">Дружелюбен к детям:</span> 
                                                <span className="detail-value">{selectedApplication.petDetails.isKidFriendly ? 'Да' : 'Нет'}</span>
                                            </div>
                                        )}
                                        {selectedApplication.petDetails.isPetFriendly !== undefined && (
                                            <div className="detail-row">
                                                <span className="detail-label">Дружелюбен к другим животным:</span> 
                                                <span className="detail-value">{selectedApplication.petDetails.isPetFriendly ? 'Да' : 'Нет'}</span>
                                            </div>
                                        )}
                                        {selectedApplication.petDetails.hypoallergenic !== undefined && (
                                            <div className="detail-row">
                                                <span className="detail-label">Гипоаллергенный:</span> 
                                                <span className="detail-value">{selectedApplication.petDetails.hypoallergenic ? 'Да' : 'Нет'}</span>
                                            </div>
                                        )}
                                        {selectedApplication.petDetails.medicalNotes && (
                                            <div className="detail-row">
                                                <span className="detail-label">Медицинские заметки:</span> 
                                                <span className="detail-value description">{selectedApplication.petDetails.medicalNotes}</span>
                                            </div>
                                        )}
                                        <div className="detail-row">
                                            <span className="detail-label">Статус питомца:</span> 
                                            <span className="detail-value">
                                                {selectedApplication.petDetails.status === "Adopted" ? 
                                                    "Усыновлен" : 
                                                    selectedApplication.petDetails.status === "Approved" ? 
                                                        "Доступен для усыновления" : 
                                                        "В процессе рассмотрения"
                                                }
                                            </span>
                                        </div>
                                        <div className="detail-row">
                                            <span className="detail-label">Описание:</span> 
                                            <span className="detail-value description">{selectedApplication.petDetails.description}</span>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <p className="no-pet-info">Информация о питомце не доступна</p>
                            )}
                            
                            {/* Информация о приюте */}
                            {selectedApplication.petDetails?.shelterDetails && (
                                <div className="shelter-info-section">
                                    <h3>Информация о приюте</h3>
                                    <div className="pet-info-list">
                                        <div className="detail-row">
                                            <span className="detail-label">Название приюта:</span> 
                                            <span className="detail-value">{selectedApplication.petDetails.shelter_name || selectedApplication.petDetails.shelterDetails.name || 'Не указано'}</span>
                                        </div>
                                        {selectedApplication.petDetails.shelter_city && (
                                            <div className="detail-row">
                                                <span className="detail-label">Город:</span> 
                                                <span className="detail-value">{selectedApplication.petDetails.shelter_city}</span>
                                            </div>
                                        )}
                                        {selectedApplication.petDetails.shelter_address && (
                                            <div className="detail-row">
                                                <span className="detail-label">Адрес:</span> 
                                                <span className="detail-value">{selectedApplication.petDetails.shelter_address}</span>
                                            </div>
                                        )}
                                        {selectedApplication.petDetails.shelter_phone && (
                                            <div className="detail-row">
                                                <span className="detail-label">Телефон:</span> 
                                                <span className="detail-value">
                                                    <a href={`tel:${selectedApplication.petDetails.shelter_phone}`}>
                                                        {selectedApplication.petDetails.shelter_phone}
                                                    </a>
                                                </span>
                                            </div>
                                        )}
                                        {selectedApplication.petDetails.shelter_email && (
                                            <div className="detail-row">
                                                <span className="detail-label">Email:</span> 
                                                <span className="detail-value">
                                                    <a href={`mailto:${selectedApplication.petDetails.shelter_email}`}>
                                                        {selectedApplication.petDetails.shelter_email}
                                                    </a>
                                                </span>
                                            </div>
                                        )}
                                        {selectedApplication.petDetails.shelterDetails.description && (
                                            <div className="detail-row">
                                                <span className="detail-label">Описание приюта:</span> 
                                                <span className="detail-value description">{selectedApplication.petDetails.shelterDetails.description}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="application-info-column">
                            <h3>Информация о заявке</h3>
                            <div className="app-info-list">
                                <div className="detail-row">
                                    <span className="detail-label">Дата подачи:</span> 
                                    <span className="detail-value">{formatDate(selectedApplication.createdAt)}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Телефон:</span> 
                                    <span className="detail-value">{selectedApplication.phoneNo}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Email:</span> 
                                    <span className="detail-value">{selectedApplication.email}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Условия проживания:</span> 
                                    <span className="detail-value">{selectedApplication.livingSituation}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Опыт с животными:</span> 
                                    <span className="detail-value description">{selectedApplication.previousExperience}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Состав семьи:</span> 
                                    <span className="detail-value description">{selectedApplication.familyComposition}</span>
                                </div>
                            </div>
                            
                            {/* Инструкции для пользователя в зависимости от статуса */}
                            <div className="application-instructions">
                                <h3>Что дальше?</h3>
                                {getApplicationStatus(selectedApplication) === "Approved" ? (
                                    <div className="instruction-box approved-instructions">
                                        <p><strong>Поздравляем!</strong> Ваша заявка одобрена.</p>
                                        <p>В ближайшее время с вами свяжется наш сотрудник для организации встречи с питомцем и оформления документов.</p>
                                        {selectedApplication.petDetails?.shelterDetails && (
                                            <>
                                                <p>Приют: {selectedApplication.petDetails.shelterDetails.name}</p>
                                                <p>Телефон приюта: <a href={`tel:${selectedApplication.petDetails.shelterDetails.phone}`}>{selectedApplication.petDetails.shelterDetails.phone}</a></p>
                                            </>
                                        )}
                                    </div>
                                ) : getApplicationStatus(selectedApplication) === "InReview" ? (
                                    <div className="instruction-box inreview-instructions">
                                        <p>Ваша заявка находится на рассмотрении.</p>
                                        <p>Мы свяжемся с вами в ближайшее время для уточнения деталей.</p>
                                        <p>Обычно процесс рассмотрения занимает 1-3 рабочих дня.</p>
                                    </div>
                                ) : getApplicationStatus(selectedApplication) === "Rejected" ? (
                                    <div className="instruction-box rejected-instructions">
                                        <p><strong>К сожалению, этот питомец уже нашел дом.</strong></p>
                                        <p>Ваша заявка была автоматически отклонена, так как этот питомец был усыновлен другим пользователем.</p>
                                        <p>Приглашаем вас рассмотреть других питомцев, которые ищут дом:</p>
                                        <div className="find-other-pet">
                                            <a href="/pawfinds/pets" className="other-pet-btn">Посмотреть других питомцев</a>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="instruction-box pending-instructions">
                                        <p>Ваша заявка ожидает рассмотрения.</p>
                                        <p>Пожалуйста, дождитесь ответа от наших сотрудников.</p>
                                        <p>Обычно заявки рассматриваются в течение 3-5 рабочих дней.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : applications.length > 0 ? (
                <div className="applications-grid">
                    {applications.map((app, index) => {
                        const status = getApplicationStatus(app);
                        return (
                            <div 
                                key={index} 
                                className={`application-card ${getApplicationHighlightClass(app._id)}`} 
                                onClick={() => handleViewApplication(app)}
                            >
                                <div className="application-card-header">
                                    <div className="pet-image">
                                        <img 
                                            src={getPetImageUrl(app.petDetails?.filename)} 
                                            alt={app.petDetails?.name || 'Питомец'} 
                                            onError={(e) => {
                                                e.target.src = "/api/images/default.jpg";
                                            }}
                                        />
                                    </div>
                                    <div className={`app-status status-${status.toLowerCase()}`}>
                                        {translateStatus(status)}
                                        {isStatusChanged(app._id) && <span className="status-update-badge">Обновлено</span>}
                                    </div>
                                </div>
                                <div className="application-card-content">
                                    <h3 className="pet-name">{app.petDetails?.name || 'Неизвестный питомец'}</h3>
                                    <p className="pet-breed">{app.petDetails?.breed || 'Неизвестная порода'}</p>
                                    <p className="app-date">Подана: {formatDate(app.createdAt)}</p>
                                    
                                    <button className="view-details-btn">
                                        Подробнее
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="empty-applications">
                    <div className="empty-icon"></div>
                    <h3>У вас пока нет заявок</h3>
                    <p>Найдите питомца и подайте заявку на усыновление</p>
                    <a href="/pawfinds/pets" className="find-pet-btn">Найти питомца</a>
                </div>
            )}
        </div>
    );
};

export default AdoptionApplications;

