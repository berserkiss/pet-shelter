import React, { useState } from 'react';
import { useAuthContext } from '../../hooks/UseAuthContext';
import './DonationForm.css';

const DonationForm = ({ shelterId, petId, shelterName, petName, onSuccess }) => {
  const { user } = useAuthContext();
  const [formData, setFormData] = useState({
    amount: '',
    currency: 'BYN',
    purpose: 'general',
    purposeDescription: '',
    donorName: user?.email?.split('@')[0] || '',
    donorEmail: user?.email || '',
    donorMessage: '',
    isAnonymous: false,
    isRecurring: false,
    recurringInterval: 'monthly'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const presetAmounts = [10, 25, 50, 100, 250, 500];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const donationData = {
        ...formData,
        amount: parseFloat(formData.amount),
        shelterId: shelterId || undefined,
        petId: petId || undefined,
        userId: user?._id || undefined
      };

      const headers = {
        'Content-Type': 'application/json'
      };

      if (user?.token) {
        headers['Authorization'] = `Bearer ${user.token}`;
      }

      const response = await fetch('/api/donations', {
        method: 'POST',
        headers,
        body: JSON.stringify(donationData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Не удалось создать пожертвование');
      }

      const data = await response.json();
      setSuccess(true);
      
      // Перенаправляем на страницу оплаты
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else if (onSuccess) {
        onSuccess(data.donation);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePresetAmount = (amount) => {
    setFormData({ ...formData, amount: amount.toString() });
  };

  if (success) {
    return (
      <div className="donation-success">
        <h3>Спасибо за ваше пожертвование!</h3>
        <p>Вы будете перенаправлены на страницу оплаты...</p>
      </div>
    );
  }

  return (
    <div className="donation-form-container">
      <div className="donation-header">
        <h2>Помочь {petName ? `питомцу ${petName}` : shelterName ? `приюту "${shelterName}"` : 'приютам'}</h2>
        <p className="donation-subtitle">
          Ваше пожертвование поможет обеспечить уход за животными
        </p>
      </div>

      <form onSubmit={handleSubmit} className="donation-form">
        {/* Сумма пожертвования */}
        <div className="form-section">
          <label className="form-label">Сумма пожертвования</label>
          <div className="preset-amounts">
            {presetAmounts.map(amount => (
              <button
                key={amount}
                type="button"
                className={`preset-amount-btn ${formData.amount === amount.toString() ? 'active' : ''}`}
                onClick={() => handlePresetAmount(amount)}
              >
                {amount} BYN
              </button>
            ))}
          </div>
          <div className="custom-amount">
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="Или введите свою сумму"
              className="amount-input"
              required
            />
            <select
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              className="currency-select"
            >
              <option value="BYN">BYN</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="RUB">RUB</option>
            </select>
          </div>
        </div>

        {/* Назначение */}
        <div className="form-section">
          <label className="form-label">Назначение пожертвования</label>
          <select
            value={formData.purpose}
            onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
            className="form-select"
          >
            <option value="general">Общее (на усмотрение приюта)</option>
            <option value="food">Корм для животных</option>
            <option value="medical">Медицинская помощь</option>
            <option value="shelter">Содержание приюта</option>
            {petId && <option value="pet_specific">Конкретному питомцу</option>}
            <option value="other">Другое</option>
          </select>
          {formData.purpose === 'other' && (
            <textarea
              value={formData.purposeDescription}
              onChange={(e) => setFormData({ ...formData, purposeDescription: e.target.value })}
              placeholder="Укажите назначение..."
              className="form-textarea"
              maxLength={200}
            />
          )}
        </div>

        {/* Информация о доноре */}
        <div className="form-section">
          <label className="form-label">Ваша информация</label>
          <div className="form-row">
            <input
              type="text"
              value={formData.donorName}
              onChange={(e) => setFormData({ ...formData, donorName: e.target.value })}
              placeholder="Ваше имя"
              className="form-input"
            />
            <input
              type="email"
              value={formData.donorEmail}
              onChange={(e) => setFormData({ ...formData, donorEmail: e.target.value })}
              placeholder="Email"
              className="form-input"
              required
            />
          </div>
          <textarea
            value={formData.donorMessage}
            onChange={(e) => setFormData({ ...formData, donorMessage: e.target.value })}
            placeholder="Сообщение (необязательно)"
            className="form-textarea"
            maxLength={500}
            rows={3}
          />
        </div>

        {/* Дополнительные опции */}
        <div className="form-section">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={formData.isAnonymous}
              onChange={(e) => setFormData({ ...formData, isAnonymous: e.target.checked })}
            />
            <span>Анонимное пожертвование</span>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={formData.isRecurring}
              onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
            />
            <span>Регулярное пожертвование</span>
          </label>
          {formData.isRecurring && (
            <select
              value={formData.recurringInterval}
              onChange={(e) => setFormData({ ...formData, recurringInterval: e.target.value })}
              className="form-select"
            >
              <option value="monthly">Ежемесячно</option>
              <option value="quarterly">Ежеквартально</option>
              <option value="yearly">Ежегодно</option>
            </select>
          )}
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="donate-button"
          disabled={loading || !formData.amount || parseFloat(formData.amount) < 0.01}
        >
          {loading ? 'Обработка...' : `Пожертвовать ${formData.amount ? parseFloat(formData.amount).toFixed(2) : ''} ${formData.currency}`}
        </button>
      </form>
    </div>
  );
};

export default DonationForm;

