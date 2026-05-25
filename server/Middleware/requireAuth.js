const jwt = require('jsonwebtoken')
const Token = require('../Model/TokenModel')
const User = require('../Model/UserModel')

const requireAuth = async (req, res, next) => {
    // Get the token from the Authorization header
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization token required' })
    }

    const token = authHeader.split(' ')[1]

    try {
        // Try to decode the token first to get user ID
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.SECRET)
        } catch (jwtError) {
            // If token is expired but we can still decode it, try to refresh
            if (jwtError.name === 'TokenExpiredError') {
                try {
                    const decodedExpired = jwt.decode(token);
                    if (decodedExpired && decodedExpired._id) {
                        // Generate a custom error with user ID for potential refresh
                        const error = new Error('Token expired');
                        error.userId = decodedExpired._id;
                        error.name = 'TokenExpiredWithId';
                        throw error;
                    }
                } catch (decodeError) {
                    return res.status(401).json({ error: 'Invalid token format' });
                }
            }
            throw jwtError;
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
            const user = await User.findById(decoded._id);
            if (user?.isBlocked) {
                return res.status(403).json({ error: 'Ваш аккаунт заблокирован. Обратитесь к администратору.' });
            }
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Get user
        const user = await User.findById(decoded._id);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        if (user.isBlocked) {
            return res.status(403).json({ error: 'Ваш аккаунт заблокирован. Обратитесь к администратору.' });
        }

        // Add user to request object
        req.user = user;
        next();
    } catch (error) {
        // Special handling for expired tokens where we have user ID
        if (error.name === 'TokenExpiredWithId') {
            return res.status(401).json({ 
                error: 'Token expired',
                code: 'TOKEN_EXPIRED',
                userId: error.userId
            });
        }
        // Handle token verification errors
        console.error('Auth error:', error.name, error.message);
        res.status(401).json({ error: 'Invalid token' });
    }
}

module.exports = requireAuth