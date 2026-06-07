const User = require('../Model/UserModel');
const Token = require('../Model/TokenModel');
const AdoptForm = require('../Model/AdoptFormModel');
const Volunteer = require('../Model/VolunteerModel');
const Favorite = require('../Model/FavoriteModel');
const PetCareCalendar = require('../Model/PetCareCalendarModel');
const ChatHistory = require('../Model/ChatHistoryModel');
const jwt = require('jsonwebtoken');
const validator = require('validator')
const bcrypt = require('bcryptjs')
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/** Cookie refresh-токена: Secure при HTTPS за прокси (X-Forwarded-Proto) или в production */
const refreshCookieOpts = (req) => {
    const forwarded = (req.headers['x-forwarded-proto'] || '').toString().split(',')[0].trim();
    const secure =
        process.env.NODE_ENV === 'production' ||
        req.secure === true ||
        forwarded === 'https';
    return {
        httpOnly: true,
        secure,
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000
    };
};

// Generate access token - short lived
const createToken = (_id) => {
    return jwt.sign({ _id }, process.env.SECRET, { expiresIn: '2h' });
};

// Generate refresh token - long lived
const createRefreshToken = (_id) => {
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    return {
        token: refreshToken,
        expiresAt
    };
};

// Save token to database
const saveToken = async (userId, token, type, expiresAt) => {
    await Token.create({
        userId,
        token,
        type,
        expiresAt
    });
    return token;
};

const loginUser = async (req, res) => {
    console.log('loginUser called with body:', req.body);
    const { email, password } = req.body;
    try {
        const user = await User.login(email, password);
        const userName = user.name;
        const role = user.role;
        const userId = user._id;
        
        // Create tokens
        const accessToken = createToken(user._id);
        const refreshTokenData = createRefreshToken(user._id);
        
        // Save both tokens
        await saveToken(user._id, accessToken, 'access', new Date(Date.now() + 2 * 60 * 60 * 1000)); // 2 hours
        const refreshToken = await saveToken(user._id, refreshTokenData.token, 'refresh', refreshTokenData.expiresAt);
        
        res.cookie('refreshToken', refreshToken, refreshCookieOpts(req));
        
        console.log('Login successful for user:', email);
        res.status(200).json({
            userName,
            email,
            token: accessToken,
            role,
            _id: userId,
            hasPassword: !!user.password,
            authProvider: user.authProvider || 'local',
        });
    } catch (error) {
        console.log('Login error for user:', email, 'Error:', error.message);
        res.status(400).json({ error: error.message });
    }
};

const signupUser = async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const user = await User.signup(name, email, password);
        const userName = user.name;
        const userId = user._id;
        
        // Create tokens
        const accessToken = createToken(user._id);
        const refreshTokenData = createRefreshToken(user._id);
        
        // Save both tokens
        await saveToken(user._id, accessToken, 'access', new Date(Date.now() + 2 * 60 * 60 * 1000)); // 2 hours
        const refreshToken = await saveToken(user._id, refreshTokenData.token, 'refresh', refreshTokenData.expiresAt);
        
        res.cookie('refreshToken', refreshToken, refreshCookieOpts(req));
        
        res.status(200).json({
            userName,
            email,
            token: accessToken,
            _id: userId,
            hasPassword: !!user.password,
            authProvider: user.authProvider || 'local',
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const googleAuth = async (req, res) => {
    const { credential } = req.body;

    if (!credential) {
        return res.status(400).json({ error: 'Google credential required' });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
        return res.status(500).json({ error: 'Google OAuth не настроен на сервере' });
    }

    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const googleId = payload.sub;
        const name = payload.name;
        const email = payload.email;

        if (!googleId || !email) {
            return res.status(400).json({ error: 'Не удалось получить данные Google аккаунта' });
        }

        let user = await User.findOne({ $or: [{ googleId }, { email: email.toLowerCase() }] });

        if (user && user.isBlocked) {
            return res.status(403).json({ error: 'Ваш аккаунт заблокирован. Обратитесь к администратору.' });
        }

        if (!user) {
            user = await User.create({
                name,
                email: email.toLowerCase(),
                googleId,
                authProvider: 'google',
            });
        } else if (!user.googleId) {
            user.googleId = googleId;
            user.authProvider = 'google';
            await user.save();
        }

        const accessToken = createToken(user._id);
        const refreshTokenData = createRefreshToken(user._id);
        await saveToken(user._id, accessToken, 'access', new Date(Date.now() + 2 * 60 * 60 * 1000));
        const refreshToken = await saveToken(user._id, refreshTokenData.token, 'refresh', refreshTokenData.expiresAt);

        res.cookie('refreshToken', refreshToken, refreshCookieOpts(req));
        res.status(200).json({
            userName: user.name,
            email: user.email,
            token: accessToken,
            role: user.role,
            _id: user._id,
            hasPassword: !!user.password,
            authProvider: user.authProvider || 'google',
        });
    } catch (error) {
        console.error('Google auth error:', error);
        res.status(400).json({ error: 'Ошибка Google авторизации: ' + error.message });
    }
};

// Handle token refresh
const refreshUserToken = async (req, res) => {
    const { refreshToken } = req.cookies;
    
    if (!refreshToken) {
        return res.status(401).json({ error: 'Refresh token required' });
    }
    
    try {
        // Find the refresh token in the database
        const storedToken = await Token.findOne({ 
            token: refreshToken,
            type: 'refresh',
            isRevoked: false,
            expiresAt: { $gt: new Date() }
        });
        
        if (!storedToken) {
            return res.status(401).json({ error: 'Invalid or expired refresh token' });
        }
        
        // Get the user
        const user = await User.findById(storedToken.userId);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        if (user.isBlocked) {
            res.clearCookie('refreshToken', refreshCookieOpts(req));
            return res.status(403).json({ error: 'Ваш аккаунт заблокирован. Обратитесь к администратору.' });
        }
        
        // Generate new tokens
        const accessToken = createToken(user._id);
        const newRefreshTokenData = createRefreshToken(user._id);
        
        // Save both new tokens
        await saveToken(user._id, accessToken, 'access', new Date(Date.now() + 2 * 60 * 60 * 1000)); // 2 hours
        const newRefreshToken = await saveToken(user._id, newRefreshTokenData.token, 'refresh', newRefreshTokenData.expiresAt);
        
        // Revoke the old refresh token
        storedToken.isRevoked = true;
        await storedToken.save();
        
        res.cookie('refreshToken', newRefreshToken, refreshCookieOpts(req));
        
        res.status(200).json({
            token: accessToken,
            userName: user.name,
            email: user.email,
            role: user.role,
            _id: user._id,
            hasPassword: !!user.password,
            authProvider: user.authProvider || 'local',
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const logoutUser = async (req, res) => {
    try {
    const { refreshToken } = req.cookies;
        const accessToken = req.headers.authorization?.split(' ')[1];
    
    if (refreshToken) {
            // Отзываем refresh токен
            await Token.findOneAndUpdate(
                { token: refreshToken, type: 'refresh' },
                { isRevoked: true }
            );
        }

        if (accessToken) {
            // Отзываем текущий access токен
            await Token.findOneAndUpdate(
                { token: accessToken, type: 'access' },
                { isRevoked: true }
            );
        }

        if (req.user) {
            // Отзываем все access токены пользователя
            await Token.updateMany(
                { userId: req.user._id, type: 'access' },
                { isRevoked: true }
            );
    }
    
        const c = refreshCookieOpts(req);
        res.clearCookie('refreshToken', {
            httpOnly: c.httpOnly,
            secure: c.secure,
            sameSite: c.sameSite
        });

    res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Failed to logout properly' });
    }
};

const updateUser = async (req, res) => {
    const { name, email } = req.body;

    try {
        if (!name || !email) {
            throw Error('Все поля должны быть заполнены')
        }

        // Проверка валидности имени
        if (name.length < 3 || name.length > 30) {
            throw Error('Имя должно содержать от 3 до 30 символов');
        }

        if (!/^[a-zA-Zа-яА-Я0-9\s]+$/.test(name)) {
            throw Error('Имя может содержать только буквы, цифры и пробелы');
        }

        const user = await User.findOne({ email });

        if (!user) {
            throw Error('Пользователь не найден');
        }

        if (user.name === name) {
            throw Error('Изменения не обнаружены');
        }

        // Обновляем только имя, email остается неизменным
        user.name = name;

        const updatedUser = await user.save();

        res.status(200).json({ updatedUser });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const updatePassword = async (req, res) => {
    console.log('updatePassword called with body:', req.body);
    const { email, newPassword, newConfirmPassword } = req.body
    try {
        if (!email || !newPassword || !newConfirmPassword) {
            console.log('Missing fields:', { email: !!email, newPassword: !!newPassword, newConfirmPassword: !!newConfirmPassword });
            throw Error('Все поля должны быть заполнены')
        }
        if (!validator.isStrongPassword(newPassword)) {
            console.log('Password not strong enough');
            throw Error('Пароль недостаточно сложный')
        }
        if (!(newPassword === newConfirmPassword)) {
            console.log('Passwords do not match');
            throw Error('Пароли не совпадают')
        }
        const exists = await User.findOne({ email })
        if (!exists) {
            console.log('User not found for email:', email);
            throw Error('Email не найден')
        }
        const match = await bcrypt.compare(newPassword, exists.password);
        if (match) {
            console.log('New password matches old password');
            throw Error("Вы не можете использовать старый пароль");
        }
        const salt = await bcrypt.genSalt(10)
        const hassed = await bcrypt.hash(newPassword, salt)
        exists.password = hassed
        const updatedUser = await exists.save()
        console.log('Password updated successfully for user:', email);
        res.status(200).json({ success: true, email: updatedUser.email })
    } catch (error) {
        console.log('updatePassword error:', error.message);
        res.status(400).json({ error: error.message })
    }
}

const updateProfile = async (req, res) => {
    try {
        const { userName, /* другие поля */ } = req.body;
        
        // Проверка валидности имени
        if (!userName || userName.length < 3 || userName.length > 30) {
            return res.status(400).json({ error: 'Имя должно содержать от 3 до 30 символов' });
        }
        
        if (!/^[a-zA-Zа-яА-Я0-9\s]+$/.test(userName)) {
            return res.status(400).json({ error: 'Имя может содержать только буквы, цифры и пробелы' });
        }
        
        // Продолжаем обновление профиля
        // ...существующий код
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteUser = async (req, res) => {
    try {
        const userId = req.user._id;
        const { password, confirmEmail } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        if (user.password) {
            if (!password) {
                return res.status(400).json({ error: 'Введите пароль для подтверждения' });
            }
            const match = await bcrypt.compare(password, user.password);
            if (!match) {
                return res.status(400).json({ error: 'Неверный пароль' });
            }
        } else {
            if (!confirmEmail || confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
                return res.status(400).json({ error: 'Email не совпадает с вашим аккаунтом' });
            }
        }

        await Token.deleteMany({ userId });
        await AdoptForm.deleteMany({ user_id: userId });
        await Volunteer.deleteMany({ user_id: userId });
        await Favorite.deleteMany({ user_id: userId });
        await PetCareCalendar.deleteMany({ userId });
        await ChatHistory.deleteMany({ userId });
        await User.findByIdAndDelete(userId);

        const c = refreshCookieOpts(req);
        res.clearCookie('refreshToken', {
            httpOnly: c.httpOnly,
            secure: c.secure,
            sameSite: c.sameSite
        });

        res.status(200).json({ message: 'Аккаунт успешно удалён' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Не удалось удалить аккаунт' });
    }
};

module.exports = { loginUser, signupUser, googleAuth, refreshUserToken, logoutUser, updateUser, updatePassword, updateProfile, deleteUser };
