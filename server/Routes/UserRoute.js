const express = require('express')
const router = express.Router()
const {loginUser, signupUser, googleAuth, updateUser, updatePassword, refreshUserToken, logoutUser, deleteUser} = require('../Controller/UserController')
const requireAuth = require('../Middleware/requireAuth')

router.post('/login', loginUser)
router.post('/signup', signupUser)
router.post('/google-auth', googleAuth)
router.post('/refresh-token', refreshUserToken)
router.post('/logout', logoutUser)
router.put('/update', updateUser)
router.put('/update-password', updatePassword)
router.put('/reset-password', updatePassword)
router.delete('/delete', requireAuth, deleteUser)

module.exports = router