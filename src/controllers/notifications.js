const Notification = require('../models/Notification');

module.exports = {
    getMyNotifications: async (req, res) => {
        try {
            const notifications = await Notification.find({
                $or: [{ recipientRoles: req.user.role }, { recipientUsers: req.user._id }]
            }).sort({ createdAt: -1 }).limit(50).lean();
            const data = notifications.map((notification) => ({
                ...notification,
                isRead: notification.readBy.some((id) => id.toString() === req.user._id.toString())
            }));
            return res.status(200).json({ status: 200, data });
        } catch (error) {
            return res.status(500).json({ status: 500, message: 'Unable to load notifications' });
        }
    },

    markAllRead: async (req, res) => {
        try {
            await Notification.updateMany(
                { $or: [{ recipientRoles: req.user.role }, { recipientUsers: req.user._id }], readBy: { $ne: req.user._id } },
                { $addToSet: { readBy: req.user._id } }
            );
            return res.status(200).json({ status: 200, message: 'Notifications marked as read' });
        } catch (error) {
            return res.status(500).json({ status: 500, message: 'Unable to update notifications' });
        }
    }
};
