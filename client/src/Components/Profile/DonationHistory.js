import React, { useState } from 'react';

const DonationHistory = ({
    donations,
    loading,
    recentlyUpdatedDonations
}) => {
    const [selectedDonation, setSelectedDonation] = useState(null);

    // Формат даты
    const formatDate = (dateString) => {
        const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Date(dateString).toLocaleDateString('ru-RU', options);
    };

    // Формат суммы
    const formatAmount = (amount, currency = 'BYN') => {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: currency === 'BYN' ? 'BYN' : currency,
            minimumFractionDigits: 2
        }).format(amount);
    };

    // Функция для определения класса highlighting для пожертвования
    const getDonationHighlightClass = (donationId) => {
        return recentlyUpdatedDonations[donationId] ? "status-just-updated" : "";
    };

    // Статус изменения
    const isDonationStatusChanged = (donationId) => {
        return recentlyUpdatedDonations[donationId] || false;
    };

    // Обработчик для просмотра детальной информации о пожертвовании
    const handleViewDonation = (donation) => {
        setSelectedDonation(donation);
    };

    // Закрытие детальной информации
    const handleCloseDetails = () => {
        setSelectedDonation(null);
    };

    // Подсчет общей суммы пожертвований
    const totalAmount = donations.reduce((sum, donation) => sum + (donation.amount || 0), 0);
    const totalCount = donations.length;

    return (
        <div className="content-section applications-section">
            <h1>История пожертвований</h1>
            
            {loading ? (
                <div className="loading-indicator">Загрузка истории пожертвований...</div>
            ) : selectedDonation ? (
                <div className="application-details-view">
                    <button className="back-button" onClick={handleCloseDetails}>
                        <span className="icon">←</span> Назад к списку
                    </button>
                    
                    <div className="application-detail-header">
                        <h2>Детали пожертвования</h2>
                        <div className={`app-status status status-completed ${isDonationStatusChanged(selectedDonation._id) ? 'status-just-updated' : ''}`}>
                            Завершено
                            {isDonationStatusChanged(selectedDonation._id) && <span className="status-update-badge">Новое</span>}
                        </div>
                    </div>
                    
                    <div className="application-detail-content">
                        <div className="pet-details-column">
                            <h3>Информация о пожертвовании</h3>
                            <div className="detail-row">
                                <span className="detail-label">Сумма:</span> 
                                <span className="detail-value donation-amount">{formatAmount(selectedDonation.amount, selectedDonation.currency)}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Дата:</span> 
                                <span className="detail-value">{formatDate(selectedDonation.createdAt)}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Статус:</span> 
                                <span className="detail-value">
                                    {selectedDonation.paymentStatus === 'completed' ? 'Завершено' : 
                                     selectedDonation.paymentStatus === 'pending' ? 'Ожидает' :
                                     selectedDonation.paymentStatus === 'failed' ? 'Ошибка' : 
                                     selectedDonation.paymentStatus}
                                </span>
                            </div>
                            {selectedDonation.message && (
                                <div className="detail-row">
                                    <span className="detail-label">Сообщение:</span> 
                                    <span className="detail-value">{selectedDonation.message}</span>
                                </div>
                            )}
                        </div>
                        
                        <div className="pet-details-column">
                            <h3>Информация о приюте</h3>
                            {selectedDonation.shelter_id && typeof selectedDonation.shelter_id === 'object' ? (
                                <>
                                    <div className="detail-row">
                                        <span className="detail-label">Название приюта:</span> 
                                        <span className="detail-value">{selectedDonation.shelter_id.name || 'Не указано'}</span>
                                    </div>
                                    {selectedDonation.shelter_id.city && (
                                        <div className="detail-row">
                                            <span className="detail-label">Город:</span> 
                                            <span className="detail-value">{selectedDonation.shelter_id.city}</span>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="detail-row">
                                    <span className="detail-label">Приют:</span> 
                                    <span className="detail-value">Информация загружается...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : donations.length === 0 ? (
                <div className="donation-empty-state">
                    <div className="donation-empty-icon"></div>
                    <h3>У вас пока нет пожертвований</h3>
                    <p>Когда вы сделаете пожертвование, оно появится здесь.</p>
                </div>
            ) : (
                <>
                    {/* Статистика */}
                    <div className="donation-summary">
                        <div className="summary-item">
                            <span className="summary-label">Всего пожертвовано:</span>
                            <span className="summary-value">{formatAmount(totalAmount, donations[0]?.currency || 'BYN')}</span>
                            </div>
                        <div className="summary-item">
                            <span className="summary-label">Количество пожертвований:</span>
                            <span className="summary-value">{totalCount}</span>
                        </div>
                    </div>

                    {/* Таблица пожертвований */}
                    <div className="donations-table-container">
                        <table className="donations-table">
                            <thead>
                                <tr>
                                    <th>Дата</th>
                                    <th>Приют</th>
                                    <th>Сумма</th>
                                    <th>Статус</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                        {donations.map((donation) => (
                                    <tr 
                                key={donation._id} 
                                        className={`donation-row ${getDonationHighlightClass(donation._id)}`}
                                onClick={() => handleViewDonation(donation)}
                            >
                                        <td className="donation-date-cell">
                                            {new Date(donation.createdAt).toLocaleDateString('ru-RU', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric'
                                            })}
                                        </td>
                                        <td className="donation-shelter-cell">
                                            {donation.shelter_id && typeof donation.shelter_id === 'object' 
                                                ? donation.shelter_id.name 
                                                : 'Приют'}
                                        </td>
                                        <td className="donation-amount-cell">
                                            {formatAmount(donation.amount, donation.currency)}
                                        </td>
                                        <td className="donation-status-cell">
                                            <span className={`status-badge status-completed ${isDonationStatusChanged(donation._id) ? 'status-just-updated' : ''}`}>
                                                Завершено
                                                {isDonationStatusChanged(donation._id) && <span className="new-indicator">Новое</span>}
                                            </span>
                                        </td>
                                        <td className="donation-action-cell">
                                            <button className="view-details-btn">Подробнее</button>
                                        </td>
                                    </tr>
                        ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
};

export default DonationHistory;

