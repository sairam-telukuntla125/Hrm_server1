const Users = require('../models/Users');
const LeaveRequest = require('../models/LeaveRequest');
const Attendance = require('../models/Attendance');
const Payroll = require('../models/Payroll');

module.exports = {
    getStats: async (req, res) => {
        try {
            const role = req.user.role;
            let data = {};

            if (role === 'admin' || role === 'hr') {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const [totalEmployees, pendingLeaves, todayAttendanceCount, pendingLeaveRequests, todayAttendanceRecords, totalPayrolls] = await Promise.all([
                    Users.countDocuments({ deletedAt: null }),
                    LeaveRequest.countDocuments({ status: 'Pending' }),
                    Attendance.countDocuments({ date: { $gte: today } }),
                    LeaveRequest.find({ status: 'Pending' })
                        .populate('userId', 'name email department designation')
                        .sort({ createdAt: -1 })
                        .limit(20),
                    Attendance.find({ date: { $gte: today } })
                        .populate('userId', 'name email department designation')
                        .sort({ checkIn: -1 }),
                    Payroll.countDocuments()
                ]);

                data = {
                    totalEmployees,
                    pendingLeaves,
                    todayAttendance: todayAttendanceCount,
                    totalPayrolls,
                    pendingLeaveRequests,
                    todayAttendanceRecords
                };
            } else {
                const [myPendingLeaves, myAttendanceToday] = await Promise.all([
                    LeaveRequest.countDocuments({ userId: req.user._id, status: 'Pending' }),
                    Attendance.findOne({ userId: req.user._id, date: { $gte: (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })() } })
                ]);
                data = { myPendingLeaves, myAttendanceToday };
            }

            return res.status(200).json({ status: 200, data });
        } catch (error) {
            return res.status(500).json({ status: 500, message: 'Internal server error' });
        }
    }
};
