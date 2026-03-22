const Favorite = require('../Model/FavoriteModel');
const Pet = require('../Model/PetModel');

/**
 * Добавить питомца в избранное
 * POST /api/favorites
 */
const addFavorite = async (req, res) => {
    try {
        const { pet_id } = req.body;
        const user_id = req.user._id;

        if (!pet_id) {
            return res.status(400).json({ error: 'pet_id обязателен' });
        }

        // Проверяем существование питомца
        const pet = await Pet.findById(pet_id);
        if (!pet) {
            return res.status(404).json({ error: 'Питомец не найден' });
        }

        // Проверяем, не добавлен ли уже в избранное
        const existingFavorite = await Favorite.findOne({ user_id, pet_id });
        if (existingFavorite) {
            return res.status(400).json({ error: 'Питомец уже в избранном' });
        }

        // Создаем запись об избранном
        const favorite = await Favorite.create({
            user_id,
            pet_id
        });

        // Отправляем WebSocket событие
        const io = req.app.get('io');
        if (io) {
            io.emit('favoriteAdded', {
                _id: favorite._id,
                user_id: favorite.user_id,
                pet_id: favorite.pet_id,
                pet: pet
            });
            console.log('WebSocket: Отправлено событие о добавлении в избранное');
        }

        res.status(201).json({
            success: true,
            message: 'Питомец добавлен в избранное',
            favorite: {
                _id: favorite._id,
                pet_id: favorite.pet_id,
                createdAt: favorite.createdAt
            }
        });
    } catch (error) {
        console.error('Ошибка добавления в избранное:', error);
        
        // Обработка ошибки дубликата
        if (error.code === 11000) {
            return res.status(400).json({ error: 'Питомец уже в избранном' });
        }
        
        res.status(500).json({ error: 'Ошибка при добавлении в избранное: ' + error.message });
    }
};

/**
 * Удалить питомца из избранного
 * DELETE /api/favorites/:petId
 */
const removeFavorite = async (req, res) => {
    try {
        const { petId } = req.params;
        const user_id = req.user._id;

        const favorite = await Favorite.findOneAndDelete({ user_id, pet_id: petId });

        if (!favorite) {
            return res.status(404).json({ error: 'Питомец не найден в избранном' });
        }

        // Отправляем WebSocket событие
        const io = req.app.get('io');
        if (io) {
            io.emit('favoriteRemoved', {
                user_id: favorite.user_id,
                pet_id: favorite.pet_id
            });
            console.log('WebSocket: Отправлено событие об удалении из избранного');
        }

        res.status(200).json({
            success: true,
            message: 'Питомец удален из избранного'
        });
    } catch (error) {
        console.error('Ошибка удаления из избранного:', error);
        res.status(500).json({ error: 'Ошибка при удалении из избранного: ' + error.message });
    }
};

/**
 * Получить все избранные питомцы пользователя
 * GET /api/favorites
 */
const getFavorites = async (req, res) => {
    try {
        const user_id = req.user._id;

        // Без match по status: усыновлённые и др. остаются в избранном (карточка + «Просмотр»).
        // Записи без документа питомца (удалён из БД) отфильтруем ниже.
        const favorites = await Favorite.find({ user_id })
            .populate({
                path: 'pet_id',
                select: 'name species breed birthDate description filename size energyLevel careLevel activityNeeds isKidFriendly isPetFriendly hypoallergenic temperamentTraits area shelter_id status adopter_email',
                populate: {
                    path: 'shelter_id',
                    select: 'name _id'
                }
            })
            .sort({ createdAt: -1 });

        const validFavorites = favorites.filter((fav) => fav.pet_id != null);

        res.status(200).json({
            success: true,
            favorites: validFavorites.map(fav => ({
                _id: fav._id,
                pet: fav.pet_id,
                createdAt: fav.createdAt
            }))
        });
    } catch (error) {
        console.error('Ошибка получения избранного:', error);
        res.status(500).json({ error: 'Ошибка при получении избранного: ' + error.message });
    }
};

/**
 * Проверить, добавлен ли питомец в избранное
 * GET /api/favorites/check/:petId
 */
const checkFavorite = async (req, res) => {
    try {
        const { petId } = req.params;
        const user_id = req.user._id;

        const favorite = await Favorite.findOne({ user_id, pet_id: petId });

        res.status(200).json({
            success: true,
            isFavorite: !!favorite,
            favoriteId: favorite ? favorite._id : null
        });
    } catch (error) {
        console.error('Ошибка проверки избранного:', error);
        res.status(500).json({ error: 'Ошибка при проверке избранного: ' + error.message });
    }
};

/**
 * Получить статус избранного для нескольких питомцев
 * POST /api/favorites/check-multiple
 */
const checkMultipleFavorites = async (req, res) => {
    try {
        const { petIds } = req.body;
        const user_id = req.user._id;

        if (!Array.isArray(petIds) || petIds.length === 0) {
            return res.status(400).json({ error: 'petIds должен быть массивом' });
        }

        const favorites = await Favorite.find({
            user_id,
            pet_id: { $in: petIds }
        });

        // Создаем объект с статусами
        const favoriteStatuses = {};
        favorites.forEach(fav => {
            favoriteStatuses[fav.pet_id.toString()] = {
                isFavorite: true,
                favoriteId: fav._id
            };
        });

        // Добавляем false для тех, кого нет в избранном
        petIds.forEach(petId => {
            if (!favoriteStatuses[petId]) {
                favoriteStatuses[petId] = {
                    isFavorite: false,
                    favoriteId: null
                };
            }
        });

        res.status(200).json({
            success: true,
            favorites: favoriteStatuses
        });
    } catch (error) {
        console.error('Ошибка проверки избранного:', error);
        res.status(500).json({ error: 'Ошибка при проверке избранного: ' + error.message });
    }
};

module.exports = {
    addFavorite,
    removeFavorite,
    getFavorites,
    checkFavorite,
    checkMultipleFavorites
};
