const express = require('express');
const router = express.Router();
const { addFavorite, removeFavorite, getFavorites, checkFavorite, checkMultipleFavorites } = require('../Controller/FavoriteController');

// Получить все избранные питомцы пользователя
router.get('/', getFavorites);

// Добавить питомца в избранное
router.post('/', addFavorite);

// Удалить питомца из избранного
router.delete('/:petId', removeFavorite);

// Проверить, добавлен ли питомец в избранное
router.get('/check/:petId', checkFavorite);

// Проверить статус избранного для нескольких питомцев
router.post('/check-multiple', checkMultipleFavorites);

module.exports = router;
