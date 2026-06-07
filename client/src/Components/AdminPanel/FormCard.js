import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useAuthContext } from '../../hooks/UseAuthContext';
import './FormCard.css';
import { getPetImageUrl } from '../../utils/petImageUrl';

const FormCard = (props) => {
  // Status translations
  const statusTranslation = {
    'Pending': 'Ожидает рассмотрения',
    'InReview': 'На рассмотрении',
    'Approved': 'Принята',
    'Rejected': 'Отклонена'
  };

  // Status to icon mapping
  const statusIcons = {
    'Pending': '⏳',
    'InReview': '🔍',
    'Approved': '✅',
    'Rejected': '❌'
  };

  const [showDetails, setShowDetails] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(statusTranslation[props.form.status] || 'Ожидает рассмотрения');
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const { user } = useAuthContext();

  // Function to directly update status
  const updateStatus = async (newStatus) => {
    if (newStatus === props.form.status) return; // No change needed
    
    setIsUpdating(true);
    setErrorMessage('');
    setSuccessMessage('');
    
    try {
      const response = await fetch(`/api/form/updateStatus/${props.form._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (!response.ok) {
        throw new Error('Не удалось обновить статус');
      }
      
      // Status updated successfully
      setCurrentStatus(statusTranslation[newStatus]);
      setSuccessMessage(`Статус изменен на "${statusTranslation[newStatus]}"`);
      
      // Update local state to reflect the new status immediately
      props.form.status = newStatus;
      
      // Refresh parent component data
      if (props.updateCards) {
        props.updateCards();
      }
    } catch (error) {
      console.error('Error updating status:', error);
      setErrorMessage(error.message || 'Произошла ошибка при обновлении статуса');
    } finally {
      setIsUpdating(false);
    }
  };

  // Get time since form was created
  const getTimeSinceCreated = () => {
    try {
      return formatDistanceToNow(new Date(props.form.createdAt), { addSuffix: true });
    } catch (e) {
      return 'недавно';
    }
  };

  // Toggle details view
  const toggleDetails = () => {
    setShowDetails(!showDetails);
  };

  // Handle form approval
  const handleApprove = async () => {
    updateStatus('Approved');
  };

  // Handle form rejection
  const handleReject = async () => {
    updateStatus('Rejected');
  };

  // Handle form pending status
  const handlePending = async () => {
    updateStatus('Pending');
  };

  // Handle form in review status
  const handleInReview = async () => {
    updateStatus('InReview');
  };

  return (
    <div className="form-card">
      <div className={`form-status-badge status-${props.form.status.toLowerCase()}`}>
        <span className="status-icon">{statusIcons[props.form.status] || '⏳'}</span>
        {currentStatus}
      </div>
      
      {/* Error and success messages */}
      {errorMessage && (
        <div className="form-message error-message">
          {errorMessage}
          <button className="close-message-btn" onClick={() => setErrorMessage('')}>✕</button>
        </div>
      )}
      
      {successMessage && (
        <div className="form-message success-message">
          {successMessage}
          <button className="close-message-btn" onClick={() => setSuccessMessage('')}>✕</button>
        </div>
      )}

      <div className="form-header">
        <div className="petpic-container">
          <img
            src={getPetImageUrl(props.pet?.filename)}
            alt={props.pet?.name || 'Pet'}
            onError={(e) => {
              e.target.src = '/api/images/default.jpg';
            }}
          />
        </div>

        <div className="form-header-details">
          <div className="pet-name">{props.pet?.name || 'Без имени'}</div>
          <div className="pet-breed">{props.pet?.breed || 'Не указана порода'}</div>
          <div className="form-time">{getTimeSinceCreated()}</div>
        </div>
      </div>

      <div className="applicant-info">
        <div className="info-row">
          <span className="info-label">Email:</span>
          <span className="info-value">{props.form.email}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Телефон:</span>
          <span className="info-value">{props.form.phoneNo}</span>
        </div>
      </div>

      <div className="form-actions">
        <button className="action-button details-button" onClick={toggleDetails}>
          {showDetails ? 'Скрыть детали' : 'Показать детали'}
        </button>
        
        <div className="status-actions">
          <div className="status-actions-label">Изменить статус:</div>
          <div className="status-buttons">
            <button 
              className={`status-button pending ${props.form.status === 'Pending' ? 'active' : ''}`}
              onClick={handlePending}
              disabled={props.form.status === 'Pending' || isUpdating}
              title="Ожидает рассмотрения"
            >
              ⏳
            </button>
            <button 
              className={`status-button review ${props.form.status === 'InReview' ? 'active' : ''}`}
              onClick={handleInReview}
              disabled={props.form.status === 'InReview' || isUpdating}
              title="На рассмотрении"
            >
              🔍
            </button>
            <button 
              className={`status-button approve ${props.form.status === 'Approved' ? 'active' : ''}`}
              onClick={handleApprove}
              disabled={props.form.status === 'Approved' || isUpdating}
              title="Принять"
            >
              ✅
            </button>
            <button 
              className={`status-button reject ${props.form.status === 'Rejected' ? 'active' : ''}`}
              onClick={handleReject}
              disabled={props.form.status === 'Rejected' || isUpdating}
              title="Отклонить"
            >
              ❌
            </button>
          </div>
        </div>
      </div>

      {/* Expanded details section */}
      {showDetails && (
        <div className="expanded-details">
          <h3>Подробная информация о заявке</h3>
          
          <div className="details-section">
            <h4>Информация о заявителе</h4>
            <div className="details-grid">
              <div className="detail-row">
                <span className="detail-label">Email:</span>
                <span className="detail-value">{props.form.email}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Телефон:</span>
                <span className="detail-value">{props.form.phoneNo}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Дата подачи:</span>
                <span className="detail-value">
                  {new Date(props.form.createdAt).toLocaleDateString('ru-RU', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Условия проживания:</span>
                <span className="detail-value detail-multiline">{props.form.livingSituation}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Опыт с животными:</span>
                <span className="detail-value detail-multiline">{props.form.previousExperience}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Состав семьи:</span>
                <span className="detail-value detail-multiline">{props.form.familyComposition}</span>
              </div>
            </div>
          </div>
          
          <div className="details-section">
            <h4>Информация о питомце</h4>
            <div className="details-grid">
              <div className="detail-row">
                <span className="detail-label">Имя:</span>
                <span className="detail-value">{props.pet?.name || 'Не указано'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Вид:</span>
                <span className="detail-value">{props.pet?.species || 'Не указано'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Порода:</span>
                <span className="detail-value">{props.pet?.breed || 'Не указано'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Описание:</span>
                <span className="detail-value detail-multiline">{props.pet?.description || 'Нет описания'}</span>
              </div>
            </div>
          </div>
          
          <div className="details-actions">
            <button 
              className={`details-status-button pending ${props.form.status === 'Pending' ? 'active' : ''}`}
              onClick={handlePending}
              disabled={props.form.status === 'Pending' || isUpdating}
            >
              <span className="button-icon">⏳</span>
              Ожидает рассмотрения
            </button>
            <button 
              className={`details-status-button review ${props.form.status === 'InReview' ? 'active' : ''}`}
              onClick={handleInReview}
              disabled={props.form.status === 'InReview' || isUpdating}
            >
              <span className="button-icon">🔍</span>
              На рассмотрении
            </button>
            <button 
              className={`details-status-button approve ${props.form.status === 'Approved' ? 'active' : ''}`}
              onClick={handleApprove}
              disabled={props.form.status === 'Approved' || isUpdating}
            >
              <span className="button-icon">✅</span>
              Принять заявку
            </button>
            <button 
              className={`details-status-button reject ${props.form.status === 'Rejected' ? 'active' : ''}`}
              onClick={handleReject}
              disabled={props.form.status === 'Rejected' || isUpdating}
            >
              <span className="button-icon">❌</span>
              Отклонить заявку
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FormCard;
