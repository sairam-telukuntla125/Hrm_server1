const Notification = require('../models/Notification');

const createNotification = (data) => Notification.create(data).catch((error) => {
    // Notifications must not prevent the business action from succeeding.
    console.error('Notification creation failed:', error.message);
    return null;
});

module.exports = { createNotification };
