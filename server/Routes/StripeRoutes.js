const express = require('express');
const router = express.Router();
const {
    createPaymentIntent,
    confirmPayment,
    handleStripeWebhook
} = require('../Controller/StripeController');
const optionalAuth = require('../Middleware/OptionalAuth');

// Создание платежного интента (может быть с авторизацией или без)
router.post('/create-payment-intent', optionalAuth, createPaymentIntent);

// Подтверждение платежа
router.post('/confirm-payment', optionalAuth, confirmPayment);

// Webhook от Stripe (должен быть без body parser middleware)
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

module.exports = router;

