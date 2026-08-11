const mongoose = require('mongoose');

const payslipRequestSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    reason: { type: String, default: '' },
    status: { type: String, enum: ['Pending', 'Processed', 'Rejected'], default: 'Pending' },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Users' },
    payrollId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payroll' }
}, { timestamps: true });

module.exports = mongoose.model('PayslipRequest', payslipRequestSchema, 'PayslipRequests');
