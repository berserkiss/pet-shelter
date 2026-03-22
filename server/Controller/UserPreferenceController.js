const User = require('../Model/UserModel');

const sanitizeStringArray = (value) => {
    if (!value) {
        return [];
    }

    const arrayValue = Array.isArray(value) ? value : [value];

    return arrayValue
        .filter((item) => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((item, index, arr) => arr.indexOf(item) === index);
};

const sanitizeStringValue = (value) => {
    if (typeof value !== 'string') {
        return '';
    }
    return value.trim();
};

const sanitizeBoolean = (value) => {
    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'string') {
        return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
    }

    return Boolean(value);
};

const getUserPreferences = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const user = await User.findById(req.user._id).select('preferences');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const preferences = user.preferences ? user.preferences.toObject() : {};

        res.status(200).json(preferences);
    } catch (error) {
        console.error('Error fetching user preferences:', error);
        res.status(500).json({ error: 'Failed to fetch preferences' });
    }
};

const updateUserPreferences = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const currentPreferences = user.preferences ? user.preferences.toObject() : {};

        const updatedPreferences = {
            ...currentPreferences,
            preferredSpecies: sanitizeStringArray(req.body.preferredSpecies),
            preferredBreeds: sanitizeStringArray(req.body.preferredBreeds),
            preferredSizes: sanitizeStringArray(req.body.preferredSizes),
            preferredTemperaments: sanitizeStringArray(req.body.preferredTemperaments),
            preferredCities: sanitizeStringArray(req.body.preferredCities),
            activityLevel: sanitizeStringValue(req.body.activityLevel) || currentPreferences.activityLevel || '',
            careLevel: sanitizeStringValue(req.body.careLevel) || currentPreferences.careLevel || '',
            livingSpace: sanitizeStringValue(req.body.livingSpace) || currentPreferences.livingSpace || '',
            hasKids: req.body.hasKids !== undefined ? sanitizeBoolean(req.body.hasKids) : currentPreferences.hasKids || false,
            hasOtherPets: req.body.hasOtherPets !== undefined ? sanitizeBoolean(req.body.hasOtherPets) : currentPreferences.hasOtherPets || false,
            allergyFriendly: req.body.allergyFriendly !== undefined ? sanitizeBoolean(req.body.allergyFriendly) : currentPreferences.allergyFriendly || false
        };

        user.preferences = updatedPreferences;
        await user.save();

        // Уведомляем клиента через сокеты
        try {
            const io = req.app.get('io');
            if (io) {
                if (user._id) io.to(`userId:${user._id}`).emit('userPreferencesUpdated');
                if (user.email) io.to(`user:${user.email}`).emit('userPreferencesUpdated');
            }
        } catch (e) {
            console.warn('Failed to emit preferences update socket event:', e.message);
        }

        res.status(200).json(user.preferences.toObject ? user.preferences.toObject() : user.preferences);
    } catch (error) {
        console.error('Error updating user preferences:', error);
        res.status(500).json({ error: 'Failed to update preferences' });
    }
};

const clearUserPreferences = async (req, res) => {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.preferences = {
            preferredSpecies: [],
            preferredBreeds: [],
            preferredSizes: [],
            preferredTemperaments: [],
            preferredCities: [],
            activityLevel: '',
            careLevel: '',
            livingSpace: '',
            hasKids: false,
            hasOtherPets: false,
            allergyFriendly: false,
            energyLevel: '',
            preferredAgeRange: ''
        };

        await user.save();

        // Очищаем историю чата для всех режимов
        try {
            const ChatHistory = require('../Model/ChatHistoryModel');
            const userId = user._id.toString();
            
            // Архивируем все активные истории чата для пользователя
            await ChatHistory.updateMany(
                { userId, isActive: true },
                { $set: { isActive: false } }
            );
            
            console.log(`🗑️ История чата очищена для пользователя ${userId} при очистке предпочтений`);
        } catch (chatError) {
            console.warn('⚠️ Не удалось очистить историю чата при очистке предпочтений:', chatError.message);
            // Не критично, продолжаем работу
        }

        // Уведомляем клиента через сокеты
        try {
            const io = req.app.get('io');
            if (io) {
                if (user._id) io.to(`userId:${user._id}`).emit('userPreferencesUpdated');
                if (user.email) io.to(`user:${user.email}`).emit('userPreferencesUpdated');
            }
        } catch (e) {
            console.warn('Failed to emit preferences clear socket event:', e.message);
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error clearing user preferences:', error);
        res.status(500).json({ error: 'Failed to clear preferences' });
    }
};

module.exports = {
    getUserPreferences,
    updateUserPreferences,
    clearUserPreferences
};

