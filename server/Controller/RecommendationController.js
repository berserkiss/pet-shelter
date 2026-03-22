const mongoose = require('mongoose');
const Pet = require('../Model/PetModel');
const User = require('../Model/UserModel');
const { scorePetsForUser } = require('../services/recommendationService');
const { getAIRecommendations, getCompareRecommendation } = require('../services/aiRecommendationService');

const hasMeaningfulPreferences = (preferences = {}) => {
    if (!preferences) {
        return false;
    }

    const arrayFields = [
        'preferredSpecies',
        'preferredBreeds',
        'preferredSizes',
        'preferredTemperaments',
        'preferredCities'
    ];

    const stringFields = ['activityLevel', 'careLevel', 'livingSpace'];

    const booleanFields = ['hasKids', 'hasOtherPets', 'allergyFriendly'];

    const anyArrayFilled = arrayFields.some((field) => Array.isArray(preferences[field]) && preferences[field].length > 0);
    const anyStringFilled = stringFields.some((field) => typeof preferences[field] === 'string' && preferences[field].trim().length > 0);
    const anyBooleanTrue = booleanFields.some((field) => preferences[field] === true);

    return anyArrayFilled || anyStringFilled || anyBooleanTrue;
};

const getPetRecommendations = async (req, res) => {
    try {
        const limit = req.query.limit ? Math.max(1, Math.min(parseInt(req.query.limit, 10), 50)) : 12;

        const userId = req.user && req.user._id ? req.user._id : null;

        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const [user, pets] = await Promise.all([
            User.findById(userId).select('preferences'),
            Pet.find({ status: 'Approved' }).lean()
        ]);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!Array.isArray(pets) || pets.length === 0) {
            return res.status(200).json({
                hasPreferences: hasMeaningfulPreferences(user.preferences),
                recommendations: []
            });
        }

        const filteredPets = pets.filter((pet) => {
            if (!pet.user_id) {
                return true;
            }
            try {
                return pet.user_id.toString() !== userId.toString();
            } catch (err) {
                return true;
            }
        });

        const useAI = req.query.useAI !== 'false' && process.env.GEMINI_API_KEY;

        let recommendations;
        if (useAI) {
            console.log('🤖 Используем AI рекомендации');
            recommendations = await getAIRecommendations(filteredPets, user.preferences, { limit });
        } else {
            console.log('📊 Используем rule-based рекомендации');
            recommendations = scorePetsForUser(filteredPets, user.preferences, { limit });
        }

        res.status(200).json({
            hasPreferences: hasMeaningfulPreferences(user.preferences),
            recommendations,
            aiPowered: useAI
        });
    } catch (error) {
        console.error('Error generating pet recommendations:', error);
        res.status(500).json({ error: 'Failed to generate recommendations' });
    }
};

/**
 * AI-рекомендация при сравнении избранных питомцев
 * POST /recommendations/compare
 * Body: { petIds: string[] } — массив ID питомцев (2–4 шт)
 */
const getCompareRecommendationHandler = async (req, res) => {
    try {
        const userId = req.user && req.user._id ? req.user._id : null;
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { petIds } = req.body;
        if (!Array.isArray(petIds) || petIds.length < 2 || petIds.length > 4) {
            return res.status(400).json({ error: 'Укажите от 2 до 4 питомцев для сравнения' });
        }

        const [user, pets] = await Promise.all([
            User.findById(userId).select('preferences'),
            // Избранное может содержать усыновлённых — сравниваем по id без фильтра по статусу
            Pet.find({ _id: { $in: petIds } }).lean()
        ]);

        if (!user) return res.status(404).json({ error: 'User not found' });
        if (pets.length < 2) {
            return res.status(400).json({ error: 'Не найдено достаточно питомцев для сравнения' });
        }

        const result = await getCompareRecommendation(pets, user.preferences || {});
        res.status(200).json(result);
    } catch (error) {
        console.error('Error in compare recommendation:', error);
        res.status(500).json({ error: 'Failed to generate comparison recommendation' });
    }
};

module.exports = {
    getPetRecommendations,
    getCompareRecommendationHandler
};

