const crypto = require('crypto');
const Users = require('../models/Users');
const { mail } = require('../config');
const { sendPasswordResetEmail } = require('../utils/email');

const RESET_WINDOW_MS = 30 * 60 * 1000;
const genericMessage = 'If an active account exists for that email address, a password reset link has been sent.';

module.exports = {
    requestPasswordReset: async (req, res) => {
        const email = String(req.body.email || '').trim().toLowerCase();
        const user = await Users.findOne({ email, deletedAt: null, isActive: true });

        if (!user) {
            return res.status(200).json({ status: 200, message: genericMessage });
        }

        const token = crypto.randomBytes(32).toString('hex');
        user.passwordResetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
        user.passwordResetExpires = new Date(Date.now() + RESET_WINDOW_MS);
        await user.save();

        try {
            const resetUrl = `${mail.clientUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
            await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl });
            return res.status(200).json({ status: 200, message: genericMessage });
        } catch (error) {
            await Users.updateOne(
                { _id: user._id },
                { $unset: { passwordResetTokenHash: 1, passwordResetExpires: 1 } }
            );
            return res.status(error.status || 500).json({ status: error.status || 500, message: error.message || 'Unable to send password reset email' });
        }
    },

    resetPassword: async (req, res) => {
        const tokenHash = crypto.createHash('sha256').update(req.body.token).digest('hex');
        const user = await Users.findOne({
            passwordResetTokenHash: tokenHash,
            passwordResetExpires: { $gt: new Date() },
            deletedAt: null,
            isActive: true
        }).select('+passwordResetTokenHash +passwordResetExpires');

        if (!user) {
            return res.status(400).json({ status: 400, message: 'This password reset link is invalid or has expired.' });
        }

        user.password = req.body.password;
        user.passwordResetTokenHash = undefined;
        user.passwordResetExpires = undefined;
        user.updatedAt = new Date();
        await user.save();

        return res.status(200).json({ status: 200, message: 'Password reset successfully. You can now sign in.' });
    }
};
