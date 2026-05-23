const User = require('../Model/UserModel');
const Token = require('../Model/TokenModel');
const AdoptForm = require('../Model/AdoptFormModel');
const Volunteer = require('../Model/VolunteerModel');
const Pet = require('../Model/PetModel');

const getUsers = async (req, res) => {
    try {
        const { search = '', page = 1, limit = 20 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const query = {};
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const [users, total] = await Promise.all([
            User.find(query, { password: 0 })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            User.countDocuments(query)
        ]);

        res.status(200).json({ users, total, page: Number(page), limit: Number(limit) });
    } catch (error) {
        console.error('getUsers error:', error);
        res.status(500).json({ error: 'Не удалось загрузить пользователей' });
    }
};

const getUserDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id, { password: 0 });
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

        const [adoptFormsRaw, volunteerApps] = await Promise.all([
            AdoptForm.find({ user_id: id }).sort({ createdAt: -1 }).limit(50).lean(),
            Volunteer.find({ user_id: id })
                .populate('shelter_id', 'name city')
                .sort({ createdAt: -1 })
                .limit(50)
                .lean()
        ]);

        const petIds = [...new Set(adoptFormsRaw.map((form) => form.petId).filter(Boolean))];
        const pets = petIds.length
            ? await Pet.find({ _id: { $in: petIds } }, { name: 1, species: 1, breed: 1 }).lean()
            : [];
        const petMap = Object.fromEntries(pets.map((pet) => [pet._id.toString(), pet]));

        const adoptForms = adoptFormsRaw.map((form) => {
            const pet = petMap[form.petId];
            return {
                ...form,
                petName: pet?.name || 'Питомец не найден',
                petSpecies: pet?.species || '',
                petBreed: pet?.breed || ''
            };
        });

        res.status(200).json({ user, adoptForms, volunteerApps });
    } catch (error) {
        console.error('getUserDetails error:', error);
        res.status(500).json({ error: 'Не удалось загрузить данные пользователя' });
    }
};

const blockUser = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
        if (user.role === 'admin') return res.status(400).json({ error: 'Нельзя заблокировать администратора' });

        user.isBlocked = true;
        await user.save();

        // Отзываем все активные токены пользователя — мгновенный выход
        await Token.updateMany({ userId: user._id, isRevoked: false }, { isRevoked: true });

        const io = req.app.get('io');
        if (io) {
            io.to(`userId:${user._id}`).emit('userBlocked', {
                message: 'Ваш аккаунт заблокирован. Обратитесь к администратору.'
            });
        }

        res.status(200).json({ message: 'Пользователь заблокирован', user: { _id: user._id, isBlocked: true } });
    } catch (error) {
        console.error('blockUser error:', error);
        res.status(500).json({ error: 'Не удалось заблокировать пользователя' });
    }
};

const unblockUser = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

        user.isBlocked = false;
        await user.save();

        res.status(200).json({ message: 'Пользователь разблокирован', user: { _id: user._id, isBlocked: false } });
    } catch (error) {
        console.error('unblockUser error:', error);
        res.status(500).json({ error: 'Не удалось разблокировать пользователя' });
    }
};

module.exports = { getUsers, getUserDetails, blockUser, unblockUser };
