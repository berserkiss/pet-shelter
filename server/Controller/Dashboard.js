const express = require('express');
const User = require('../Model/UserModel'); 
const Pet = require('../Model/PetModel');
const Shelter = require('../Model/ShelterModel');
const AdoptForm = require('../Model/AdoptFormModel');
const Donation = require('../Model/DonationModel');
const { now } = require('mongoose');

// Статусы питомцев на русском
const PET_STATUS_MAP = {
    'Pending': 'На рассмотрении',
    'InReview': 'В процессе проверки',
    'Approved': 'Одобрено',
    'Adopted': 'Усыновлено',
    'Rejected': 'Отклонено'
};

// Статусы заявок на усыновление на русском
const FORM_STATUS_MAP = {
    'Pending': 'На рассмотрении',
    'InReview': 'В процессе проверки',
    'Approved': 'Одобрено',
    'Rejected': 'Отклонено'
};

// Временные интервалы на русском
const TIME_RANGES_MAP = {
    'Less than 7 days': 'Менее 7 дней',
    '1-2 weeks': '1-2 недели',
    '2-4 weeks': '2-4 недели',
    '1-2 months': '1-2 месяца',
    'More than 2 months': 'Более 2 месяцев'
};

const userRegistration = async (req, res) => {
    try {
        const users = await User.aggregate([
            {
                $group: {
                    _id: null,
                    count: { $sum: 1 }
                }
            }
        ]);

        // Since aggregation returns an array, we need to return the count properly
        const totalUsers = users.length > 0 ? users[0].count : 0;  
        res.json({ count: totalUsers });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const petTypes = async (req, res) => {
    try {
        const pets = await Pet.aggregate([
            {
                $group: {
                    _id: "$species",
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json(pets);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const petsByShelter = async (req, res) => {
    try {
        // Get count of pets by shelter
        const petsByShelter = await Pet.aggregate([
            {
                $group: {
                    _id: "$shelter_id",
                    count: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: "shelters",
                    localField: "_id",
                    foreignField: "_id",
                    as: "shelter"
                }
            },
            {
                $unwind: {
                    path: "$shelter",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    _id: 1,
                    count: 1,
                    shelterName: "$shelter.name",
                    city: "$shelter.city"
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        res.json(petsByShelter);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const petStatusStats = async (req, res) => {
    try {
        const statusCounts = await Pet.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            }
        ]);

        // Преобразуем статусы в русские названия
        const translatedStatusCounts = statusCounts.map(item => ({
            _id: PET_STATUS_MAP[item._id] || item._id,
            count: item.count
        }));

        res.json(translatedStatusCounts);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const adoptionTimeStats = async (req, res) => {
    try {
        // Get adopted pets with the date they were adopted
        const adoptedPets = await Pet.find({ status: 'Adopted' }).select('createdAt updatedAt');
        
        // Calculate average time from listing to adoption in days
        const adoptionTimes = adoptedPets.map(pet => {
            const createdDate = new Date(pet.createdAt);
            const adoptedDate = new Date(pet.updatedAt);
            const days = (adoptedDate - createdDate) / (1000 * 60 * 60 * 24);
            return days;
        });
        
        // Calculate stats
        const totalPets = adoptionTimes.length;
        const averageTime = totalPets > 0 
            ? adoptionTimes.reduce((sum, time) => sum + time, 0) / totalPets 
            : 0;
        
        // Используем русские названия для временных интервалов
        const ranges = {
            'Менее 7 дней': 0,
            '1-2 недели': 0,
            '2-4 недели': 0,
            '1-2 месяца': 0,
            'Более 2 месяцев': 0
        };
        
        adoptionTimes.forEach(days => {
            if (days < 7) ranges['Менее 7 дней']++;
            else if (days < 14) ranges['1-2 недели']++;
            else if (days < 30) ranges['2-4 недели']++;
            else if (days < 60) ranges['1-2 месяца']++;
            else ranges['Более 2 месяцев']++;
        });
        
        const rangeData = Object.entries(ranges).map(([name, value]) => ({ name, value }));
        
        res.json({
            averageTime: averageTime.toFixed(1),
            totalAdopted: totalPets,
            timeRanges: rangeData
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const formStatusStats = async (req, res) => {
    try {
        const statusCounts = await AdoptForm.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            }
        ]);

        // Преобразуем статусы в русские названия
        const translatedStatusCounts = statusCounts.map(item => ({
            _id: FORM_STATUS_MAP[item._id] || item._id,
            count: item.count
        }));

        res.json(translatedStatusCounts);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const donationStats = async (req, res) => {
    try {
        // Общая статистика по пожертвованиям
        const totalStats = await Donation.aggregate([
            {
                $match: {
                    paymentStatus: 'completed'
                }
            },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: '$amount' },
                    totalCount: { $sum: 1 },
                    averageAmount: { $avg: '$amount' }
                }
            }
        ]);

        // Пожертвования по приютам
        const donationsByShelter = await Donation.aggregate([
            {
                $match: {
                    paymentStatus: 'completed'
                }
            },
            {
                $group: {
                    _id: '$shelter_id',
                    totalAmount: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'shelters',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'shelter'
                }
            },
            {
                $unwind: {
                    path: '$shelter',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    _id: 1,
                    totalAmount: 1,
                    count: 1,
                    shelterName: '$shelter.name',
                    city: '$shelter.city'
                }
            },
            {
                $sort: { totalAmount: -1 }
            }
        ]);

        // Пожертвования по месяцам (последние 12 месяцев)
        const donationsByMonth = await Donation.aggregate([
            {
                $match: {
                    paymentStatus: 'completed',
                    createdAt: {
                        $gte: new Date(new Date().setMonth(new Date().getMonth() - 12))
                    }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    totalAmount: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1 }
            }
        ]);

        // Форматируем данные по месяцам
        const formattedMonthlyData = donationsByMonth.map(item => {
            const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
            return {
                name: `${monthNames[item._id.month - 1]} ${item._id.year}`,
                amount: item.totalAmount,
                count: item.count
            };
        });

        res.json({
            total: totalStats.length > 0 ? {
                totalAmount: totalStats[0].totalAmount || 0,
                totalCount: totalStats[0].totalCount || 0,
                averageAmount: totalStats[0].averageAmount || 0
            } : {
                totalAmount: 0,
                totalCount: 0,
                averageAmount: 0
            },
            byShelter: donationsByShelter,
            byMonth: formattedMonthlyData
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    userRegistration,
    petTypes,
    petsByShelter,
    petStatusStats,
    adoptionTimeStats,
    formStatusStats,
    donationStats
}
