const mongoose = require('mongoose');

const calendarEventSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    type: { type: String, enum: ['holiday', 'leave', 'onboarding', 'meeting', 'task', 'event'], required: true },
    date: { type: Date, required: true },
    endDate: { type: Date },
    startTime: { type: String },
    endTime: { type: String },
    attendees: [{ type: String }],
    department: { type: String },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Users' }],
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    status: { type: String, enum: ['scheduled', 'in-progress', 'completed', 'cancelled'], default: 'scheduled' },
    visibility: { type: String, enum: ['all', 'admin', 'hr', 'employee'], default: 'all' },
    relatedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'Users' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Users' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Users' },
    auditTrail: [{
        action: { type: String, required: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Users' },
        timestamp: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

module.exports = mongoose.model('CalendarEvent', calendarEventSchema, 'CalendarEvents');
