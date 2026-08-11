const PayslipRequest = require('../models/PayslipRequest');
const Payroll = require('../models/Payroll');
const { createNotification } = require('../utils/notifications');

module.exports = {
    requestPayslip: async (req, res) => {
        try {
            const { month, year, reason } = req.body;
            if (!month || !year) return res.status(400).json({ status: 400, message: 'month and year are required' });

            const existing = await PayslipRequest.findOne({ userId: req.user._id, month: Number(month), year: Number(year) });
            if (existing) return res.status(409).json({ status: 409, message: 'Payslip request already submitted for this month/year' });

            const request = new PayslipRequest({ userId: req.user._id, month: Number(month), year: Number(year), reason: reason || '' });
            await request.save();
            await createNotification({
                type: 'payslip',
                title: 'New payslip request',
                message: `${req.user.name} requested a payslip for ${month}/${year}.`,
                link: '/admin/payroll',
                recipientRoles: ['admin', 'hr']
            });
            return res.status(201).json({ status: 201, message: 'Payslip request submitted', data: request });
        } catch (error) {
            return res.status(500).json({ status: 500, message: error.message || 'Internal server error' });
        }
    },

    getMyRequests: async (req, res) => {
        try {
            const requests = await PayslipRequest.find({ userId: req.user._id })
                .populate('payrollId')
                .sort({ createdAt: -1 });
            return res.status(200).json({ status: 200, data: requests });
        } catch (error) {
            return res.status(500).json({ status: 500, message: 'Internal server error' });
        }
    },

    getAllRequests: async (req, res) => {
        try {
            const requests = await PayslipRequest.find()
                .populate('userId', 'name email department designation salary allowances')
                .populate('processedBy', 'name')
                .populate('payrollId')
                .sort({ createdAt: -1 });
            return res.status(200).json({ status: 200, data: requests });
        } catch (error) {
            return res.status(500).json({ status: 500, message: 'Internal server error' });
        }
    },

    updateRequestStatus: async (req, res) => {
        try {
            const { status } = req.body;
            const request = await PayslipRequest.findById(req.params.id).populate('userId', 'name salary allowances department designation');
            if (!request) return res.status(404).json({ status: 404, message: 'Request not found' });

            request.status = status;
            request.processedBy = req.user._id;

            if (status === 'Processed') {
                const existing = await Payroll.findOne({ userId: request.userId._id, month: request.month, year: request.year });
                if (existing) {
                    request.payrollId = existing._id;
                }
            }

            await request.save();
            return res.status(200).json({ status: 200, message: `Request ${status}`, data: request });
        } catch (error) {
            return res.status(500).json({ status: 500, message: 'Internal server error' });
        }
    }
};
