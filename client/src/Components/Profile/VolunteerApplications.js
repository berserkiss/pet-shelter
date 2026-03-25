import React, { useState } from 'react';
import { formatAge } from '../../utils/ageFormatter';

const VolunteerApplications = ({
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

    // Функция для определения класса highlighting для волонтерской заявки
    const getVolunteerHighlightClass = (appId) => {
        return recentlyUpdatedApps[appId] ? "status-just-updated" : "";
    };

    // Статус изменения для волонтерских заявок
    const isVolunteerStatusChanged = (appId) => {
        return recentlyUpdatedApps[appId] || false;
    };

    // Обработчик для просмотра волонтерской заявки
    const handleViewVolunteerApplication = (app) => {
        setSelectedApplication(app);
    };

    // Закрытие детальной информации о заявке
    const handleCloseDetails = () => {
        setSelectedApplication(null);
    };

    return (
        <div className="content-section applications-section">
            <h1>
                Мои заявки на волонтерство
            </h1>
            
            {loading ? (
                <div className="loading-indicator">Загрузка заявок...</div>
            ) : selectedApplication ? (
                <div className="application-details-view">
                    <button className="back-button" onClick={handleCloseDetails}>
                        <span className="icon">←</span> Назад к списку
                    </button>
                    
                    <div className="application-detail-header">
                        <h2>Заявка на волонтерство</h2>
                        <div className={`app-status status status-${selectedApplication.status.toLowerCase()} ${isVolunteerStatusChanged(selectedApplication._id) ? 'status-just-updated' : ''}`}>
                            {translateVolunteerStatus(selectedApplication.status)}
                            {isVolunteerStatusChanged(selectedApplication._id) && <span className="status-update-badge">Обновлено</span>}
                        </div>
                    </div>
                    
                    <div className="application-detail-content">
                        <div className="pet-details-column">
                            <h3>Информация о приюте</h3>
                            <div className="detail-row">
                                <span className="detail-label">Название приюта:</span> 
                                <span className="detail-value">{selectedApplication.shelter_name || 'Информация загружается...'}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Город:</span> 
                                <span className="detail-value">{selectedApplication.shelter_city || 'Не указан'}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Адрес:</span> 
                                <span className="detail-value">{selectedApplication.shelter_address || 'Не указан'}</span>
                            </div>
                        </div>
                        
                        <div className="application-info-column">
                            <h3>Информация о заявке</h3>
                            <div className="app-info-list">
                                <div className="detail-row">
                                    <span className="detail-label">Дата подачи:</span> 
                                    <span className="detail-value">{formatDate(selectedApplication.createdAt)}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Имя:</span> 
                                    <span className="detail-value">{selectedApplication.name}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Возраст:</span> 
                                    <span className="detail-value">{selectedApplication.age}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Телефон:</span> 
                                    <span className="detail-value">{selectedApplication.phone}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Доступность:</span> 
                                    <span className="detail-value">{selectedApplication.availability}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Опыт:</span> 
                                    <span className="detail-value description">{selectedApplication.experience || 'Не указан'}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="detail-label">Сообщение:</span> 
                                    <span className="detail-value description">{selectedApplication.message}</span>
                                </div>
                                {selectedApplication.adminMessage && (
                                    <div className="detail-row">
                                        <span className="detail-label">Ответ администратора:</span> 
                                        <span className="detail-value description">{selectedApplication.adminMessage}</span>
                                    </div>
                                )}
                            </div>
                            
                            <div className="application-instructions">
                                <h3>Что дальше?</h3>
                                {selectedApplication.status === "Approved" ? (
                                    <div className="instruction-box approved-instructions">
                                        <p><strong>Поздравляем!</strong> Ваша заявка на волонтерство одобрена.</p>
                                        <p>В ближайшее время с вами свяжется представитель приюта для обсуждения дальнейших шагов.</p>
                                        <p>Вы можете связаться с приютом напрямую по телефону, указанному в профиле приюта.</p>
                                    </div>
                                ) : selectedApplication.status === "Rejected" ? (
                                    <div className="instruction-box rejected-instructions">
                                        <p><strong>К сожалению, ваша заявка была отклонена.</strong></p>
                                        <p>Пожалуйста, ознакомьтесь с комментарием администратора, если он был предоставлен.</p>
                                        <p>Возможно, вы сможете подать заявку в другой приют или повторно подать заявку в этот приют через некоторое время.</p>
                                    </div>
                                ) : (
                                    <div className="instruction-box pending-instructions">
                                        <p>Ваша заявка ожидает рассмотрения.</p>
                                        <p>Пожалуйста, дождитесь ответа от администрации приюта.</p>
                                        <p>Обычно заявки рассматриваются в течение 3-5 рабочих дней.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : applications.length > 0 ? (
                <div className="applications-grid">
                    {applications.map((app, index) => (
                        <div 
                            key={index} 
                            className={`application-card ${getVolunteerHighlightClass(app._id)}`} 
                            onClick={() => handleViewVolunteerApplication(app)}
                        >
                            <div className="application-card-header">
                                <div className="shelter-icon">
                                    {/* Copy of PawSVG from HomeRedesigned.js */}
                                    <svg width="38" height="38" viewBox="0 0 48.839 48.839" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                        <path
                                            fill="currentColor"
                                            d="M39.041,36.843c2.054,3.234,3.022,4.951,3.022,6.742c0,3.537-2.627,5.252-6.166,5.252
        c-1.56,0-2.567-0.002-5.112-1.326c0,0-1.649-1.509-5.508-1.354c-3.895-0.154-5.545,1.373-5.545,1.373
        c-2.545,1.323-3.516,1.309-5.074,1.309c-3.539,0-6.168-1.713-6.168-5.252c0-1.791,0.971-3.506,3.024-6.742
        c0,0,3.881-6.445,7.244-9.477c2.43-2.188,5.973-2.18,5.973-2.18h1.093v-0.001c0,0,3.698-0.009,5.976,2.181
        C35.059,30.51,39.041,36.844,39.041,36.843z M16.631,20.878c3.7,0,6.699-4.674,6.699-10.439S20.331,0,16.631,0
        S9.932,4.674,9.932,10.439S12.931,20.878,16.631,20.878z M10.211,30.988c2.727-1.259,3.349-5.723,1.388-9.971
        s-5.761-6.672-8.488-5.414s-3.348,5.723-1.388,9.971C3.684,29.822,7.484,32.245,10.211,30.988z M32.206,20.878
        c3.7,0,6.7-4.674,6.7-10.439S35.906,0,32.206,0s-6.699,4.674-6.699,10.439C25.507,16.204,28.506,20.878,32.206,20.878z
         M45.727,15.602c-2.728-1.259-6.527,1.165-8.488,5.414s-1.339,8.713,1.389,9.972c2.728,1.258,6.527-1.166,8.488-5.414
        S48.455,16.861,45.727,15.602z"
                                        />
                                    </svg>
                                </div>
                                <div className={`app-status status-${app.status.toLowerCase()}`}>
                                    {translateVolunteerStatus(app.status)}
                                    {isVolunteerStatusChanged(app._id) && <span className="status-update-badge">Обновлено</span>}
                                </div>
                            </div>
                            <div className="application-card-content">
                                <h3 className="shelter-name">{app.shelter_name || (app.shelterDetails ? app.shelterDetails.name : 'Приют')}</h3>
                                {app.shelterDetails && (
                                    <p className="shelter-location">{app.shelterDetails.city || 'Город не указан'}</p>
                                )}
                                <p className="availability">{app.availability || 'График работы не указан'}</p>
                                <p className="app-date">Подана: {formatDate(app.createdAt)}</p>
                                
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
                    <h3>У вас пока нет заявок на волонтерство</h3>
                    <p>Выберите приют и подайте заявку на волонтерство</p>
                    <a href="/pawfinds/shelters" className="find-pet-btn">Выбрать приют</a>
                </div>
            )}
        </div>
    );
};

export default VolunteerApplications;

