const LeaveRequest = require('../models/LeaveRequest');
const { createNotification } = require('../utils/notifications');

module.exports = {
    applyLeave: async (req, res) => {
        try {
            const { type, startDate, endDate, reason } = req.body;

            if (!type || !startDate || !endDate || !reason) {
                return res.status(400).json({ status: 400, message: 'type, startDate, endDate and reason are required' });
            }

            const start = new Date(startDate);
            const end = new Date(endDate);

            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
                return res.status(400).json({ status: 400, message: 'Invalid date provided' });
            }

            if (start > end) {
                return res.status(400).json({ status: 400, message: 'endDate cannot be earlier than startDate' });
            }

            const leave = new LeaveRequest({
                userId: req.user._id,
                type,
                startDate: start,
                endDate: end,
                reason,
                status: 'Pending'
            });

            await leave.save();
            await createNotification({
                type: 'leave',
                title: 'New leave request',
                message: `${req.user.name} requested ${type} leave from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}.`,
                link: '/admin/leaves',
                recipientRoles: ['admin', 'hr']
            });
            return res.status(201).json({ status: 201, message: 'Leave request submitted', data: leave });
        } catch (error) {
            const message = error?.message || 'Internal server error';
            return res.status(400).json({ status: 400, message: message });
        }
    },

    getMyLeaves: async (req, res) => {
        try {
            const leaves = await LeaveRequest.find({ userId: req.user._id }).sort({ createdAt: -1 });
            return res.status(200).json({ status: 200, data: leaves });
        } catch (error) {
            return res.status(500).json({ status: 500, message: 'Internal server error' });
        }
    },

    getAllLeaves: async (req, res) => {
        try {
            const leaves = await LeaveRequest.find().populate('userId', 'name email').populate('approvedBy', 'name email').sort({ createdAt: -1 });
            return res.status(200).json({ status: 200, data: leaves });
        } catch (error) {
            return res.status(500).json({ status: 500, message: 'Internal server error' });
        }
    },

    updateLeaveStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const { status, remarks } = req.body;

            const leave = await LeaveRequest.findById(id);
            if (!leave) return res.status(404).json({ status: 404, message: 'Leave request not found' });

            leave.status = status;
            leave.remarks = remarks || 'Reviewed';
            leave.approvedBy = req.user._id;
            await leave.save();

            return res.status(200).json({ status: 200, message: `Leave ${status.toLowerCase()}`, data: leave });
        } catch (error) {
            return res.status(500).json({ status: 500, message: 'Internal server error' });
        }
    },

    deleteLeave: async (req, res) => {
        try {
            const leave = await LeaveRequest.findByIdAndDelete(req.params.id);
            if (!leave) return res.status(404).json({ status: 404, message: 'Leave request not found' });
            return res.status(200).json({ status: 200, message: 'Leave request deleted' });
        } catch (error) {
            return res.status(500).json({ status: 500, message: 'Internal server error' });
        }
    }
};
