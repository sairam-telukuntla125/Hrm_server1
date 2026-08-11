const CalendarEvent = require('../models/CalendarEvent');
const LeaveRequest = require('../models/LeaveRequest');
const OfferLetter = require('../models/OfferLetter');
const Users = require('../models/Users');
const { createNotification } = require('../utils/notifications');

module.exports = {
    createEvent: async (req, res) => {
        try {
            if (req.user.role === 'employee') {
                return res.status(403).json({ status: 403, message: 'Employees can only view calendar events' });
            }
            const event = new CalendarEvent({
                ...req.body,
                createdBy: req.user._id,
                auditTrail: [{ action: 'created', userId: req.user._id, timestamp: new Date() }]
            });
            await event.save();
            const isAdminMeeting = req.user.role === 'admin' && event.type === 'meeting';
            await createNotification({
                type: event.type === 'meeting' ? 'meeting' : 'calendar',
                title: event.type === 'meeting' ? 'New meeting scheduled' : 'New calendar event',
                message: `${req.user.name} added “${event.title}” to the company calendar.`,
                link: event.type === 'meeting' ? '/employee/calendar?type=meeting' : '/employee/calendar',
                recipientRoles: isAdminMeeting ? ['hr', 'employee'] : ['employee']
            });
            return res.status(201).json({ status: 201, message: 'Event created', data: event });
        } catch (error) {
            return res.status(400).json({ status: 400, message: error.message || 'Internal server error' });
        }
    },

    updateEvent: async (req, res) => {
        try {
            if (req.user.role === 'employee') {
                return res.status(403).json({ status: 403, message: 'Employees cannot edit calendar events' });
            }
            const event = await CalendarEvent.findById(req.params.id);
            if (!event) return res.status(404).json({ status: 404, message: 'Event not found' });

            const updated = await CalendarEvent.findByIdAndUpdate(
                req.params.id,
                { ...req.body, updatedBy: req.user._id, $push: { auditTrail: { action: 'updated', userId: req.user._id, timestamp: new Date() } } },
                { returnDocument: 'after' }
            ).populate('createdBy', 'name email').populate('participants', 'name email department');

            return res.status(200).json({ status: 200, message: 'Event updated', data: updated });
        } catch (error) {
            return res.status(400).json({ status: 400, message: error.message || 'Internal server error' });
        }
    },

    getEvents: async (req, res) => {
        try {
            const { year, month, startDate, endDate, type, department, employeeId, status } = req.query;
            const filter = {};

            if (startDate && endDate) {
                filter.date = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                };
            } else if (year || month) {
                const targetYear = Number(year) || new Date().getFullYear();
                const targetMonth = Number(month) ? Number(month) - 1 : new Date().getMonth();
                filter.date = {
                    $gte: new Date(targetYear, targetMonth, 1, 0, 0, 0, 0),
                    $lte: new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999)
                };
            }

            if (type) filter.type = type;
            if (department) filter.department = department;
            if (status) filter.status = status;
            if (employeeId) filter.$or = [{ relatedUserId: employeeId }, { participants: employeeId }];

            if (req.user.role === 'employee') {
                const visFilter = { $or: [{ visibility: { $in: ['all', 'employee'] } }, { relatedUserId: req.user._id }, { participants: req.user._id }] };
                filter.$and = filter.$and ? [...filter.$and, visFilter] : [visFilter];
            } else if (req.user.role === 'hr') {
                const visFilter = { visibility: { $in: ['all', 'hr', 'employee'] } };
                filter.$and = filter.$and ? [...filter.$and, visFilter] : [visFilter];
            }

            // Also pull approved leaves and onboarding offer letters as calendar events
            const [events, approvedLeaves, offerLetters] = await Promise.all([
                CalendarEvent.find(filter)
                    .populate('relatedUserId', 'name department')
                    .populate('participants', 'name email department')
                    .populate('createdBy', 'name')
                    .sort({ date: 1 }),
                (async () => {
                    if (type && type !== 'leave') return [];
                    const leaveFilter = { status: 'Approved' };
                    if (filter.date) {
                        leaveFilter.startDate = { $lte: filter.date.$lte };
                        leaveFilter.endDate = { $gte: filter.date.$gte };
                    }
                    if (req.user.role === 'employee') leaveFilter.userId = req.user._id;
                    if (employeeId) leaveFilter.userId = employeeId;
                    return LeaveRequest.find(leaveFilter).populate('userId', 'name department').lean();
                })(),
                (async () => {
                    if (type && type !== 'onboarding') return [];
                    if (req.user.role === 'employee') return [];
                    const offerFilter = {};
                    if (filter.date) {
                        offerFilter.createdAt = { $gte: filter.date.$gte, $lte: filter.date.$lte };
                    }
                    return OfferLetter.find(offerFilter).populate('createdBy', 'name').lean();
                })()
            ]);

            const leaveEvents = approvedLeaves.map(l => ({
                _id: l._id,
                title: `${l.userId?.name || 'Employee'} – ${l.type} Leave`,
                type: 'leave',
                date: l.startDate,
                endDate: l.endDate,
                description: l.reason,
                status: 'approved',
                visibility: 'all',
                relatedUserId: l.userId,
                department: l.userId?.department,
                isLeave: true
            }));

            const onboardingEvents = offerLetters.map(o => ({
                _id: o._id,
                title: `Onboarding – ${o.candidateName}`,
                type: 'onboarding',
                date: o.createdAt,
                endDate: o.createdAt,
                description: `Position: ${o.position} | Salary: ${o.salary}`,
                status: o.status === 'Accepted' ? 'completed' : 'scheduled',
                visibility: 'all',
                attendees: [o.candidateEmail],
                createdBy: o.createdBy,
                isOnboarding: true
            }));

            return res.status(200).json({ status: 200, data: [...events, ...leaveEvents, ...onboardingEvents] });
        } catch (error) {
            return res.status(500).json({ status: 500, message: 'Internal server error' });
        }
    },

    deleteEvent: async (req, res) => {
        try {
            if (req.user.role === 'employee') {
                return res.status(403).json({ status: 403, message: 'Employees cannot delete calendar events' });
            }
            const event = await CalendarEvent.findByIdAndDelete(req.params.id);
            if (!event) return res.status(404).json({ status: 404, message: 'Event not found' });
            return res.status(200).json({ status: 200, message: 'Event deleted' });
        } catch (error) {
            return res.status(500).json({ status: 500, message: 'Internal server error' });
        }
    }
};
