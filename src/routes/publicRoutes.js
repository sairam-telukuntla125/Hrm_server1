/* Plugins. */
const express = require('express');

/* Controllers. */
const { login } = require('../controllers/login');
const { refreshToken, logout } = require('../controllers/auth');
const { requestPasswordReset, resetPassword } = require('../controllers/passwordReset');

/* Middlewares. */
const validateRequest = require('../middlewares/validation');
const { loginSchema, forgotPasswordSchema, resetPasswordSchema } = require('../validators/authValidator');

/* Variables. */
const publicRouted = express.Router();

/* Define API. */
publicRouted.post('/login', validateRequest(loginSchema), login);
publicRouted.post('/forgot-password', validateRequest(forgotPasswordSchema), requestPasswordReset);
publicRouted.post('/reset-password', validateRequest(resetPasswordSchema), resetPassword);
publicRouted.post('/refresh-token', refreshToken);
publicRouted.post('/logout', logout);

module.exports = publicRouted;
