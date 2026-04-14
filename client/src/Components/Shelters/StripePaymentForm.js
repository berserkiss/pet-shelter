import React, { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useAuthContext } from '../../hooks/UseAuthContext';
import './StripePaymentForm.css';

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#32325d',
      fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
      fontSmoothing: 'antialiased',
      fontSize: '17px',
      lineHeight: '24px',
      '::placeholder': {
        color: '#aab7c4',
      },
    },
    invalid: {
      color: '#fa755a',
      iconColor: '#fa755a',
    },
  },
  hidePostalCode: true,
};

const StripePaymentForm = ({ 
  amount, 
  currency, 
  shelter, 
  message, 
  isAnonymous, 
  onSuccess, 
  onError 
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const { user } = useAuthContext();
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardError, setCardError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setCardError('');

    try {
      // Создаем Payment Intent на сервере
      console.log('Создание Payment Intent для приюта:', shelter._id, 'Сумма:', amount);
      
      const intentHeaders = {
        'Content-Type': 'application/json',
      };
      
      // Добавляем токен авторизации, если пользователь авторизован
      if (user?.token) {
        intentHeaders['Authorization'] = `Bearer ${user.token}`;
      }
      
      const intentResponse = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: intentHeaders,
        body: JSON.stringify({
          shelter_id: shelter._id,
          amount,
          currency
        }),
      });

      const intentData = await intentResponse.json();

      if (!intentResponse.ok) {
        throw new Error(intentData.error || 'Не удалось создать платеж');
      }

      const { clientSecret, paymentIntentId } = intentData;

      if (!clientSecret) {
        throw new Error('Не удалось получить данные для платежа');
      }

      console.log('Payment Intent создан успешно:', paymentIntentId);

      // Подтверждаем платеж с помощью Stripe
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
        },
      });

      if (error) {
        setCardError(error.message);
        onError(error.message);
        setIsProcessing(false);
        return;
      }

      if (paymentIntent.status === 'succeeded') {
        // Отправляем подтверждение на сервер
        const headers = {
          'Content-Type': 'application/json',
        };
        
        // Добавляем токен авторизации, если пользователь авторизован
        if (user?.token) {
          headers['Authorization'] = `Bearer ${user.token}`;
        }
        
        const confirmResponse = await fetch('/api/stripe/confirm-payment', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            paymentIntentId: paymentIntent.id,
            shelter_id: shelter._id,
            amount,
            currency,
            message,
            isAnonymous
          }),
        });

        const confirmData = await confirmResponse.json();

        if (confirmData.success) {
          onSuccess();
        } else {
          throw new Error(confirmData.error || 'Ошибка при сохранении пожертвования');
        }
      }
    } catch (error) {
      console.error('Payment error:', error);
      const errorMessage = error.message || 'Произошла ошибка при обработке платежа';
      setCardError(errorMessage);
      onError(errorMessage);
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="stripe-payment-form">
      <div className="card-element-wrapper">
        <label>Данные карты:</label>
        <div className="card-element-container">
          <CardElement options={CARD_ELEMENT_OPTIONS} />
        </div>
      </div>

      {cardError && (
        <div className="card-error">
          {cardError}
        </div>
      )}

      <div className="test-cards-info">
        <p><strong>Спасибо за пожертвование!</strong></p>
        <p>Платеж будет обработан через Stripe.</p>
      </div>

      <button
        type="submit"
        className="stripe-submit-btn"
        disabled={!stripe || isProcessing}
      >
        {isProcessing ? 'Обработка платежа...' : `Оплатить ${amount} BYN (~${(amount / 3.2).toFixed(2)} USD)`}
      </button>
    </form>
  );
};

export default StripePaymentForm;

