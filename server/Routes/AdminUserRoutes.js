const express = require('express');
const router = express.Router();
const { getUsers, getUserDetails, blockUser, unblockUser } = require('../Controller/AdminUserController');

const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Доступ запрещён' });
    }
    next();
};

router.get('/users', requireAdmin, getUsers);
router.get('/users/:id', requireAdmin, getUserDetails);
router.put('/users/:id/block', requireAdmin, blockUser);
router.put('/users/:id/unblock', requireAdmin, unblockUser);

module.exports = router;
