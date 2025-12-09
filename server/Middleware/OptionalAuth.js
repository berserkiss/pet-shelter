const jwt = require('jsonwebtoken');
const Token = require('../Model/TokenModel');
const User = require('../Model/UserModel');

/**
 * Опциональный middleware для авторизации
 * Устанавливает req.user если токен валиден, но не требует его обязательным
 */
const optionalAuth = async (req, res, next) => {
    // Get the token from the Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // Если токена нет, просто продолжаем без req.user
        return next();
    }

    const token = authHeader.split(' ')[1];

    try {
        // Try to decode the token first to get user ID
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.SECRET);
        } catch (jwtError) {
            // Если токен невалиден, просто продолжаем без req.user
            return next();
        }
        
        // Check if token exists in database and is valid
        const storedToken = await Token.findOne({ 
            token,
            userId: decoded._id,
            type: 'access',
            isRevoked: false,
            expiresAt: { $gt: new Date() }
        });

        if (!storedToken) {
            // Если токен не найден в БД, продолжаем без req.user
            return next();
        }

        // Get user
        const user = await User.findById(decoded._id);
        if (user) {
            // Add user to request object
            req.user = user;
        }
        
        next();
    } catch (error) {
        // При любой ошибке просто продолжаем без req.user
        console.error('Optional auth error:', error.message);
        next();
    }
};

module.exports = optionalAuth;

