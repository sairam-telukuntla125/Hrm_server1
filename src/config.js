/* Plugins. */
require('dotenv').config();

const DEV_DB_URL = process.env.DB_URL_DEV || 'mongodb://127.0.0.1:27017/hrms-test';
const PROD_DB_URL = process.env.DB_URL_PROD || DEV_DB_URL;
const defaultAccessSecret = process.env.JWT_ACCESS_SECRET || process.env.ACCESS_TOKEN || 'neuzen-ai-access-secret-change-me';
const defaultRefreshSecret = process.env.JWT_REFRESH_SECRET || process.env.REFRESH_TOKEN || 'neuzen-ai-refresh-secret-change-me';

module.exports = {
    port: Number(process.env.PORT || 3005),
    db: {
        url: process.env.ENVIRONMENT === 'DEVELOPMENT' ? DEV_DB_URL : PROD_DB_URL
    },
    jsonWebToken: {
        accessToken: defaultAccessSecret,
        refreshToken: defaultRefreshSecret
    },
    mail: {
        gmailUser: process.env.GMAIL_USER || '',
        gmailAppPassword: process.env.GMAIL_APP_PASSWORD || '',
        fromName: process.env.MAIL_FROM_NAME || 'NEUZEN AI HRMS',
        clientUrl: (process.env.CLIENT_APP_URL || process.env.CLIENT_ORIGINS || 'http://localhost:5173').split(',')[0].trim()
    }
};
