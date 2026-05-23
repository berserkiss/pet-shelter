import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { useAuthContext } from '../../hooks/UseAuthContext';
import StripePaymentForm from './StripePaymentForm';
import './DonationModal.css';

// Публичный ключ Stripe (тестовый)
const stripePromise = loadStripe('pk_test_51SbPc5Cvy4JQgmYHlZCFLunOwBiRvxGmWg8IJH9rtSSqfQW1ZjX6N3NjwFMce7QnkVGXeWM2yMqW1QReAgSJ5EIr00P8F44i0U');

const DonationModal = ({ shelter, onClose }) => {
  const { user } = useAuthContext();
  const [amount, setAmount] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [message, setMessage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const predefinedAmounts = [5, 10, 20, 50, 100, 200];

  const handleAmountClick = (value) => {
    setAmount(value);
    setCustomAmount('');
  };

  const handleCustomAmountChange = (e) => {
    const value = e.target.value;
    if (value === '' || /^\d+$/.test(value)) {
      setCustomAmount(value);
      setAmount(parseInt(value) || 0);
    }
  };

  const handleContinueToPayment = (e) => {
    e.preventDefault();
    setError('');

    const finalAmount = customAmount ? parseInt(customAmount) : amount;

    if (!finalAmount || finalAmount < 1) {
      setError('Пожалуйста, выберите сумму пожертвования');
      return;
    }

    setShowPaymentForm(true);
  };

  const handlePaymentSuccess = () => {
    setSuccess(true);
    setTimeout(() => {
      onClose(true);
    }, 2500);
  };

  const handlePaymentError = (errorMessage) => {
    setError(errorMessage);
    setShowPaymentForm(false);
  };

  if (success) {
    return (
      <div className="donation-modal-overlay" onClick={() => onClose(true)}>
        <div className="donation-modal" onClick={(e) => e.stopPropagation()}>
          <div className="donation-success">
            <h2>Спасибо за ваше пожертвование!</h2>
            <p>Ваш вклад поможет приюту "{shelter.name}" заботиться о питомцах.</p>
          </div>
        </div>
      </div>
    );
  }

  const finalAmount = customAmount ? parseInt(customAmount) : amount;

  return (
    <div className="donation-modal-overlay" onClick={() => onClose(false)}>
      <div className="donation-modal" onClick={(e) => e.stopPropagation()}>
        <button className="donation-modal-close" onClick={() => onClose(false)}>
          ×
        </button>

        <div className="donation-modal-header">
          <h2>Поддержать приют</h2>
          <p className="shelter-name">{shelter.name}</p>
          {shelter.donationDescription && (
            <p className="donation-description">{shelter.donationDescription}</p>
          )}
        </div>

        {!showPaymentForm ? (
          <form onSubmit={handleContinueToPayment} className="donation-form">
          <div className="form-section">
            <label>Выберите сумму (BYN):</label>
            <div className="amount-buttons">
              {predefinedAmounts.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`amount-btn ${amount === value && !customAmount ? 'active' : ''}`}
                  onClick={() => handleAmountClick(value)}
                >
                  {value} BYN
                </button>
              ))}
            </div>

            <div className="custom-amount-group">
              <label>Или введите свою сумму:</label>
              <input
                type="text"
                value={customAmount}
                onChange={handleCustomAmountChange}
                placeholder="Введите сумму"
                className="custom-amount-input"
              />
            </div>
          </div>

          <div className="form-section">
            <label>Сообщение (необязательно):</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Напишите пожелание или комментарий"
              maxLength={500}
              rows={3}
              className="message-input"
            />
            <small>{message.length}/500</small>
          </div>

          <div className="form-section">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
              />
              <span>Пожертвовать анонимно</span>
            </label>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="donation-summary">
            <div className="summary-row">
              <span>Сумма пожертвования:</span>
              <span className="summary-amount">
                {customAmount || amount || 0} BYN
              </span>
            </div>
            <div className="summary-note">
              Примерно ${((customAmount || amount || 0) / 3.2).toFixed(2)} USD
            </div>
          </div>

          <button
            type="submit"
            className="donation-submit-btn"
            disabled={!amount && !customAmount}
          >
            Продолжить к оплате
          </button>
        </form>
        ) : (
          <div className="donation-payment-section">
            <button 
              className="back-button"
              onClick={() => setShowPaymentForm(false)}
            >
              ← Назад к выбору суммы
            </button>
            
            <Elements stripe={stripePromise}>
              <StripePaymentForm
                amount={finalAmount}
                currency="BYN"
                shelter={shelter}
                message={message}
                isAnonymous={isAnonymous}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
              />
            </Elements>
          </div>
        )}
      </div>
    </div>
  );
};

export default DonationModal;

