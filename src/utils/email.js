const nodemailer = require('nodemailer');
const { mail } = require('../config');

const sendPasswordResetEmail = async ({ to, name, resetUrl }) => {
    if (!mail.gmailUser || !mail.gmailAppPassword) {
        const error = new Error('Password reset email is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD.');
        error.status = 503;
        throw error;
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: mail.gmailUser,
            pass: mail.gmailAppPassword
        }
    });

    try {
        await transporter.sendMail({
            from: `"${mail.fromName}" <${mail.gmailUser}>`,
            to,
            subject: 'Reset your NEUZEN AI HRMS password',
            text: `Hello ${name || 'there'},\n\nReset your HRMS password using this link (valid for 30 minutes):\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`,
            html: `<p>Hello ${name || 'there'},</p><p>Use the secure link below to set a new password for your HRMS account. This link expires in 30 minutes.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, you can safely ignore this email.</p>`
        });
    } catch (cause) {
        const error = new Error('Unable to send password reset email through Gmail. Check the sender address and Gmail App Password.');
        error.status = 502;
        error.cause = cause;
        throw error;
    }
};

module.exports = { sendPasswordResetEmail };
