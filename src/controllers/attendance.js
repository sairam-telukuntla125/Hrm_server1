const Attendance = require('../models/Attendance');

module.exports = {
    checkIn: async (req, res) => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Use the most recent record for today to correctly detect open sessions
            const existing = await Attendance.findOne({ userId: req.user._id, date: { $gte: today } }).sort({ checkIn: -1 });
            if (existing && !existing.checkOut) {
                return res.status(400).json({ status: 400, message: 'Already checked in. Please check out first.' });
            }

            const now = new Date();
            const attendance = new Attendance({
                userId: req.user._id,
                date: now,
                checkIn: now,
                status: 'Present'
            });
            await attendance.save();

            return res.status(201).json({ status: 201, message: 'Checked in successfully', data: attendance });
        } catch (error) {
            return res.status(500).json({ status: 500, message: 'Internal server error' });
        }
    },

    checkOut: async (req, res) => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const attendance = await Attendance.findOne({ userId: req.user._id, date: { $gte: today } }).sort({ checkIn: -1 });
            if (!attendance) {
                return res.status(404).json({ status: 404, message: 'No check-in found for today. Please check in first.' });
            }
            if (attendance.checkOut) {
                return res.status(400).json({ status: 400, message: 'Already checked out today.' });
            }

            const now = new Date();
            attendance.checkOut = now;
            const workedMs = now - attendance.checkIn;
            attendance.status = workedMs < 4 * 3600000 ? 'Half Day' : 'Present';
            await attendance.save();

            return res.status(200).json({ status: 200, message: 'Checked out successfully', data: attendance });
        } catch (error) {
            return res.status(500).json({ status: 500, message: 'Internal server error' });
        }
    },

    getTodayAttendance: async (req, res) => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const record = await Attendance.findOne({ userId: req.user._id, date: { $gte: today } }).sort({ checkIn: -1 });
            return res.status(200).json({ status: 200, data: record || null });
        } catch (error) {
            return res.status(500).json({ status: 500, message: 'Internal server error' });
        }
    },

    getMyAttendance: async (req, res) => {
        try {
            const records = await Attendance.find({ userId: req.user._id }).sort({ date: -1 });
            return res.status(200).json({ status: 200, data: records });
        } catch (error) {
            return res.status(500).json({ status: 500, message: 'Internal server error' });
        }
    },

    getAllAttendance: async (req, res) => {
        try {
            const records = await Attendance.find().populate('userId', 'name email department').sort({ date: -1 });
            return res.status(200).json({ status: 200, data: records });
        } catch (error) {
            return res.status(500).json({ status: 500, message: 'Internal server error' });
        }
    },

    updateAttendance: async (req, res) => {
        try {
            const { checkIn, checkOut, status } = req.body;
            const record = await Attendance.findById(req.params.id);
            if (!record) return res.status(404).json({ status: 404, message: 'Attendance record not found' });
            if (checkIn) record.checkIn = new Date(checkIn);
            if (checkOut) record.checkOut = new Date(checkOut);
            if (status) record.status = status;
            await record.save();
            return res.status(200).json({ status: 200, message: 'Attendance updated', data: record });
        } catch (error) {
            return res.status(500).json({ status: 500, message: 'Internal server error' });
        }
    },

    deleteAttendance: async (req, res) => {
        try {
            const record = await Attendance.findByIdAndDelete(req.params.id);
            if (!record) return res.status(404).json({ status: 404, message: 'Attendance record not found' });
            return res.status(200).json({ status: 200, message: 'Attendance record deleted' });
        } catch (error) {
            return res.status(500).json({ status: 500, message: 'Internal server error' });
        }
    }
};
