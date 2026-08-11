const jwt = require('jsonwebtoken');
const { jsonWebToken } = require('../config');
const Users = require('../models/Users');

module.exports = {
    refreshToken: async (req, res) => {
        try {
            const { refreshToken } = req.body || {};
            if (!refreshToken) {
                return res.status(401).json({ status: 401, message: 'Refresh token is required' });
            }

            const decoded = jwt.verify(refreshToken, jsonWebToken.refreshToken);
            const user = await Users.findById(decoded._id).select('-password');
            if (!user) {
                return res.status(401).json({ status: 401, message: 'User not found' });
            }

            const newAccessToken = await user.generateToken();
            const newRefreshToken = jwt.sign({ _id: user._id }, jsonWebToken.refreshToken, { expiresIn: '7d' });

            return res.status(200).json({
                status: 200,
                data: {
                    accessToken: newAccessToken,
                    refreshToken: newRefreshToken,
                    user: {
                        _id: user._id,
                        name: user.name,
                        email: user.email,
                        role: user.role
                    }
                }
            });
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ status: 401, message: 'Refresh token expired' });
            }
            return res.status(403).json({ status: 403, message: 'Invalid refresh token' });
        }
    },

    getMe: async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ status: 401, message: 'User not authenticated' });
            }
            return res.status(200).json({ status: 200, data: { user: req.user } });
        } catch (error) {
            return res.status(500).json({ status: 500, message: 'Internal server error' });
        }
    },

    logout: async (req, res) => {
        return res.status(200).json({ status: 200, message: 'Logged out successfully' });
    }
};
