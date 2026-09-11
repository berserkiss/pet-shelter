const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Donation = require('../Model/DonationModel');
const Shelter = require('../Model/ShelterModel');

// Кэш для курса обмена (обновляется раз в час)
let exchangeRateCache = {
    rate: 3.2, // Значение по умолчанию
    timestamp: 0
};
const EXCHANGE_RATE_CACHE_TTL = 60 * 60 * 1000; // 1 час

/**
 * Получить актуальный курс обмена BYN к USD
 * Использует бесплатный API exchangerate-api.com
 * В случае ошибки возвращает кэшированное значение или значение по умолчанию
 */
async function getExchangeRate() {
    const now = Date.now();
    
    // Если кэш актуален, возвращаем его
    if (exchangeRateCache.timestamp > 0 && (now - exchangeRateCache.timestamp) < EXCHANGE_RATE_CACHE_TTL) {
        return exchangeRateCache.rate;
    }
    
    try {
        // Используем бесплатный API для получения курса
        // Альтернативы: fixer.io, exchangerate-api.com, currencyapi.net
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/BYN');
        
        if (!response.ok) {
            throw new Error(`Exchange rate API error: ${response.status}`);
        }
        
        const data = await response.json();
        const rate = data.rates?.USD;
        
        if (rate && rate > 0) {
            exchangeRateCache.rate = rate;
            exchangeRateCache.timestamp = now;
            console.log(`✅ Курс обмена обновлен: 1 BYN = ${rate.toFixed(4)} USD`);
            return rate;
        } else {
            throw new Error('Invalid exchange rate data');
        }
    } catch (error) {
        console.warn(`⚠️ Не удалось получить актуальный курс обмена: ${error.message}. Используется кэшированное значение или значение по умолчанию.`);
        
        // Если есть кэшированное значение, используем его
        if (exchangeRateCache.timestamp > 0) {
            return exchangeRateCache.rate;
        }
        
        // Иначе возвращаем значение по умолчанию
        return 3.2; // Примерный курс
    }
}

// Создать платежный интент (Payment Intent)
const createPaymentIntent = async (req, res) => {
    try {
        const { shelter_id, amount, currency } = req.body;

        // Проверяем существование приюта
        const shelter = await Shelter.findById(shelter_id);
        if (!shelter) {
            return res.status(404).json({ error: 'Приют не найден' });
        }

        // Проверяем сумму
        if (!amount || amount < 1) {
            return res.status(400).json({ error: 'Сумма пожертвования должна быть не менее 1' });
        }

        // Определяем оригинальную валюту
        const originalCurrency = currency || 'BYN';
        
        // Получаем актуальный курс обмена BYN к USD
        const exchangeRate = await getExchangeRate();
        
        // Конвертируем сумму из BYN в USD для Stripe
        const amountInUSD = originalCurrency === 'BYN' ? amount / exchangeRate : amount;

        // Создаем Payment Intent
        // Примечание: BYN не поддерживается Stripe, используем USD для демо
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amountInUSD * 100), // Stripe работает в центах USD
            currency: 'usd', // Используем USD, так как BYN не поддерживается Stripe
            metadata: {
                shelter_id: shelter_id,
                shelter_name: shelter.name,
                user_id: (req.user && req.user._id) ? req.user._id.toString() : 'anonymous',
                original_currency: originalCurrency,
                original_amount: amount.toString() // Сохраняем оригинальную сумму в BYN
            },
            automatic_payment_methods: {
                enabled: true,
                allow_redirects: 'never'
            },
            description: `Пожертвование для приюта "${shelter.name}"`
        });

        res.status(200).json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });
    } catch (error) {
        console.error('Error creating payment intent:', error);
        res.status(500).json({ error: 'Ошибка при создании платежа: ' + error.message });
    }
};

// Подтверждение успешного платежа
const confirmPayment = async (req, res) => {
    try {
        const { 
            paymentIntentId,
            shelter_id, 
            amount, 
            currency, 
            message, 
            isAnonymous 
        } = req.body;

        // Проверяем Payment Intent в Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({ error: 'Платеж еще не завершен' });
        }

        // Используем оригинальную валюту и сумму из метаданных Payment Intent, если они есть
        // Это важно, так как Stripe не поддерживает BYN и конвертирует в USD для платежа
        const originalCurrency = paymentIntent.metadata?.original_currency || currency || 'BYN';
        const originalAmount = paymentIntent.metadata?.original_amount ? parseFloat(paymentIntent.metadata.original_amount) : amount;

        // Создаем запись о пожертвовании в базе данных
        const donationData = {
            shelter_id,
            amount: originalAmount, // Используем оригинальную сумму в BYN
            currency: originalCurrency, // Используем оригинальную валюту (BYN)
            message: message || '',
            isAnonymous: isAnonymous || false,
            paymentMethod: 'card',
            paymentStatus: 'completed',
            paymentIntentId: paymentIntentId // Сохраняем ID из Stripe
        };

        // Если пользователь авторизован и не анонимно
        if (req.user && !isAnonymous) {
            donationData.user_id = req.user._id;
            donationData.userName = req.user.userName || req.user.email?.split('@')[0] || 'Пользователь';
            donationData.email = req.user.email;
        } else if (req.user && isAnonymous) {
            // Даже если анонимно, сохраняем user_id для статистики (но не показываем имя)
            donationData.user_id = req.user._id;
        }

        const donation = await Donation.create(donationData);

        // Отправляем WebSocket событие
        const io = req.app.get('io');
        if (io) {
            io.emit('newDonation', {
                _id: donation._id,
                shelter_id,
                user_id: donation.user_id,
                amount: donation.amount, // Используем сумму из donation (в BYN)
                currency: donation.currency, // Используем валюту из donation (BYN)
                userName: donation.isAnonymous ? 'Анонимный донатор' : donation.userName
            });
            console.log('WebSocket: Отправлено событие о новом пожертвовании');
        }

        res.status(201).json({
            success: true,
            message: 'Спасибо за ваше пожертвование!',
            donation: {
                _id: donation._id,
                amount: donation.amount,
                currency: donation.currency,
                shelter_id: donation.shelter_id,
                createdAt: donation.createdAt
            }
        });
    } catch (error) {
        console.error('Error confirming payment:', error);
        res.status(500).json({ error: 'Ошибка при подтверждении платежа: ' + error.message });
    }
};

// Webhook для обработки событий от Stripe
const handleStripeWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Обработка различных событий
    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object;
            console.log('PaymentIntent succeeded:', paymentIntent.id);
            // Здесь можно добавить дополнительную логику
            break;

        case 'payment_intent.payment_failed':
            const failedPayment = event.data.object;
            console.log('Payment failed:', failedPayment.id);
            // Обработка неудачного платежа
            break;

        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
};

module.exports = {
    createPaymentIntent,
    confirmPayment,
    handleStripeWebhook
};

