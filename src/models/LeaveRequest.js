const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true },
    type: { type: String, enum: ['Sick', 'Casual', 'Annual', 'Earned', 'Unpaid'], required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    remarks: { type: String },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Users' }
}, { timestamps: true });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema, 'LeaveRequests');
