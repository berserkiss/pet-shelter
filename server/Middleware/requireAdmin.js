const User = require('../Model/UserModel');
const Token = require('../Model/TokenModel');
const jwt = require('jsonwebtoken');

const requireAdmin = async (req, res, next) => {
    // Проверяем наличие токена авторизации
    const { authorization } = req.headers;

    if (!authorization) {
        return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const token = authorization.split(' ')[1];

    try {
        // Верифицируем токен
        const { _id } = jwt.verify(token, process.env.SECRET);
        
        // Проверяем наличие токена в базе данных
        const storedToken = await Token.findOne({ 
            token,
            userId: _id,
            type: 'access',
            isRevoked: false,
            expiresAt: { $gt: new Date() }
        });

        if (!storedToken) {
            return res.status(401).json({ error: 'Недействительный или истекший токен' });
        }
        
        // Найти пользователя
        const user = await User.findOne({ _id });
        
        // Проверить роль пользователя
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ error: 'Доступ запрещен. Требуются права администратора' });
        }
        
        // Если пользователь админ, прикрепляем его к запросу и пропускаем дальше
        req.user = user;
        next();
    } catch (error) {
        console.error('Ошибка аутентификации админа:', error);
        res.status(401).json({ error: 'Запрос не авторизован' });
    }
};

module.exports = requireAdmin; 