const Donation = require('../Model/DonationModel');
const Shelter = require('../Model/ShelterModel');
const mongoose = require('mongoose');

// Создать пожертвование
const createDonation = async (req, res) => {
    try {
        const { 
            shelter_id, 
            amount, 
            currency, 
            message, 
            isAnonymous, 
            paymentMethod 
        } = req.body;

        // Проверяем существование приюта
        const shelter = await Shelter.findById(shelter_id);
        if (!shelter) {
            return res.status(404).json({ error: 'Приют не найден' });
        }

        // Проверяем сумму
        if (!amount || amount < 1) {
            return res.status(400).json({ error: 'Сумма пожертвования должна быть не менее 1' });
        }

        // Создаем пожертвование
        const donationData = {
            shelter_id,
            amount,
            currency: currency || 'BYN',
            message: message || '',
            isAnonymous: isAnonymous || false,
            paymentMethod: paymentMethod || 'card',
            paymentStatus: 'completed'
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
                amount,
                currency: donation.currency,
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
        console.error('Error creating donation:', error);
        res.status(500).json({ error: 'Ошибка при создании пожертвования' });
    }
};

const MONTHS_RU = [
    'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
    'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'
];

// Получить статистику пожертвований по приюту
const getShelterDonationStats = async (req, res) => {
    try {
        const { shelterId } = req.params;
        // scope=all — всё время (отчёты); по умолчанию — текущий календарный месяц (прогресс к цели)
        const scope = req.query.scope === 'all' ? 'all' : 'month';

        // Проверяем существование приюта
        const shelter = await Shelter.findById(shelterId);
        if (!shelter) {
            return res.status(404).json({ error: 'Приют не найден' });
        }

        const now = new Date();
        const stats = scope === 'all'
            ? await Donation.getTotalByShelter(shelterId)
            : await Donation.getTotalByShelterInCalendarMonth(shelterId, now);

        const periodLabel = `${MONTHS_RU[now.getMonth()]} ${now.getFullYear()}`;

        res.status(200).json({
            shelter_id: shelterId,
            totalAmount: stats.total,
            donationCount: stats.count,
            donationGoal: shelter.donationGoal,
            donationDescription: shelter.donationDescription,
            scope,
            periodYear: now.getFullYear(),
            periodMonth: now.getMonth() + 1,
            periodLabel
        });
    } catch (error) {
        console.error('Error getting donation stats:', error);
        res.status(500).json({ error: 'Ошибка при получении статистики пожертвований' });
    }
};

// Получить последние пожертвования по приюту
const getShelterRecentDonations = async (req, res) => {
    try {
        const { shelterId } = req.params;
        const limit = parseInt(req.query.limit) || 10;

        // Проверяем существование приюта
        const shelter = await Shelter.findById(shelterId);
        if (!shelter) {
            return res.status(404).json({ error: 'Приют не найден' });
        }

        const donations = await Donation.getRecentByShelter(shelterId, limit);

        res.status(200).json(donations);
    } catch (error) {
        console.error('Error getting recent donations:', error);
        res.status(500).json({ error: 'Ошибка при получении последних пожертвований' });
    }
};

// Получить все пожертвования пользователя (для профиля)
const getUserDonations = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Требуется авторизация' });
        }

        const donations = await Donation.find({ 
            user_id: req.user._id,
            paymentStatus: 'completed'
        })
        .populate('shelter_id', 'name city')
        .sort({ createdAt: -1 });

        res.status(200).json(donations);
    } catch (error) {
        console.error('Error getting user donations:', error);
        res.status(500).json({ error: 'Ошибка при получении пожертвований пользователя' });
    }
};

// Получить историю пожертвований по приюту, сгруппированную по месяцам
const getShelterDonationHistory = async (req, res) => {
    try {
        const { shelterId } = req.params;

        // Проверяем существование приюта
        const shelter = await Shelter.findById(shelterId);
        if (!shelter) {
            return res.status(404).json({ error: 'Приют не найден' });
        }

        // Группируем пожертвования по месяцам
        const donationsByMonth = await Donation.aggregate([
            {
                $match: {
                    shelter_id: new mongoose.Types.ObjectId(shelterId),
                    paymentStatus: 'completed'
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    totalAmount: { $sum: '$amount' },
                    count: { $sum: 1 },
                    donations: {
                        $push: {
                            amount: '$amount',
                            currency: '$currency',
                            userName: '$userName',
                            isAnonymous: '$isAnonymous',
                            message: '$message',
                            createdAt: '$createdAt'
                        }
                    }
                }
            },
            {
                $sort: { '_id.year': -1, '_id.month': -1 }
            }
        ]);

        // Форматируем данные
        const formattedHistory = donationsByMonth.map(item => {
            const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
                              'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
            return {
                year: item._id.year,
                month: item._id.month,
                monthName: `${monthNames[item._id.month - 1]} ${item._id.year}`,
                totalAmount: item.totalAmount,
                count: item.count,
                donations: item.donations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            };
        });

        res.status(200).json(formattedHistory);
    } catch (error) {
        console.error('Error getting donation history:', error);
        res.status(500).json({ error: 'Ошибка при получении истории пожертвований' });
    }
};

// Сбросить цель сбора средств для приюта (без удаления донатов) - только для админов
const resetShelterDonationGoal = async (req, res) => {
    try {
        const { shelterId } = req.params;

        // Проверяем существование приюта
        const shelter = await Shelter.findById(shelterId);
        if (!shelter) {
            return res.status(404).json({ error: 'Приют не найден' });
        }

        // Сбрасываем цель сбора средств (не удаляем донаты!)
        shelter.donationGoal = 0;
        shelter.donationDescription = '';
        await shelter.save();
        
        console.log(`🔄 Сброшена цель сбора средств для приюта ${shelter.name}`);

        // Отправляем WebSocket событие об обновлении статистики
        const io = req.app.get('io');
        if (io) {
            io.emit('donationGoalReset', { shelter_id: shelterId });
            io.to('shelters').emit('donationGoalReset', { shelter_id: shelterId });
            console.log('WebSocket: Отправлено событие о сбросе цели сбора средств');
        }

        res.status(200).json({
            success: true,
            message: `Цель сбора средств для приюта "${shelter.name}" сброшена`,
            shelter: {
                _id: shelter._id,
                donationGoal: shelter.donationGoal,
                donationDescription: shelter.donationDescription
            }
        });
    } catch (error) {
        console.error('Error resetting donation goal:', error);
        res.status(500).json({ error: 'Ошибка при сбросе цели сбора средств' });
    }
};

module.exports = {
    createDonation,
    getShelterDonationStats,
    getShelterRecentDonations,
    getUserDonations,
    getShelterDonationHistory,
    resetShelterDonationGoal
};
