const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String, default: '' },
    recipientRoles: [{ type: String, enum: ['admin', 'hr', 'employee'] }],
    recipientUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Users' }],
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Users' }]
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema, 'Notifications');
