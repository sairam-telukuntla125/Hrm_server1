const express = require('express');

/* Middlewares */
const authentication = require('../middlewares/authentication');
const roleCheck = require('../middlewares/role');

/* Controllers */
const { getMe } = require('../controllers/auth');
const employeeController = require('../controllers/employees');

const router = express.Router();

// Apply auth middleware to all protected routes
router.use(authentication);

// Auth protected
router.get('/auth/me', getMe);
router.get('/me', getMe);

// Employees
router.get('/employees', roleCheck(['admin', 'hr']), employeeController.getAllEmployees);
router.get('/employees/team', employeeController.getMyTeam);
router.get('/employees/:id', employeeController.getEmployeeById);
router.post('/employees', roleCheck(['admin', 'hr']), employeeController.createEmployee);
router.put('/employees/:id', roleCheck(['admin', 'hr']), employeeController.updateEmployee);
router.delete('/employees/:id', roleCheck(['admin']), employeeController.deleteEmployee);

// Onboarding
const onboardingController = require('../controllers/onboarding');
router.post('/onboarding/employees', roleCheck(['admin', 'hr']), onboardingController.onboardEmployee);
router.post('/onboarding/offer-letters', roleCheck(['admin', 'hr']), onboardingController.generateOfferLetter);
router.get('/onboarding/offer-letters', roleCheck(['admin', 'hr']), onboardingController.getOfferLetters);

// Attendance
const attendanceController = require('../controllers/attendance');
router.post('/attendance/check-in', attendanceController.checkIn);
router.post('/attendance/check-out', attendanceController.checkOut);
router.get('/attendance/today', attendanceController.getTodayAttendance);
router.get('/attendance/me', attendanceController.getMyAttendance);
router.get('/attendance/all', roleCheck(['admin', 'hr']), attendanceController.getAllAttendance);
router.put('/attendance/:id', roleCheck(['admin']), attendanceController.updateAttendance);
router.delete('/attendance/:id', roleCheck(['admin']), attendanceController.deleteAttendance);

// Leaves
const leavesController = require('../controllers/leaves');
router.post('/leaves', leavesController.applyLeave);
router.get('/leaves/me', leavesController.getMyLeaves);
router.get('/leaves/all', roleCheck(['admin', 'hr']), leavesController.getAllLeaves);
router.put('/leaves/:id/status', roleCheck(['admin', 'hr']), leavesController.updateLeaveStatus);
router.delete('/leaves/:id', roleCheck(['admin']), leavesController.deleteLeave);

// Payroll
const payrollController = require('../controllers/payroll');
router.get('/payroll/preview', roleCheck(['admin', 'hr']), payrollController.previewPayroll);
router.post('/payroll', roleCheck(['admin', 'hr']), payrollController.generatePayroll);
router.get('/payroll/me', payrollController.getMyPayslips);
router.get('/payroll/all', roleCheck(['admin', 'hr']), payrollController.getAllPayroll);
router.delete('/payroll/:id', roleCheck(['admin']), async (req, res) => {
    const Payroll = require('../models/Payroll');
    const fs = require('fs');
    const path = require('path');
    try {
        const p = await Payroll.findByIdAndDelete(req.params.id);
        if (!p) return res.status(404).json({ status: 404, message: 'Payroll not found' });
        if (p.payslipPath) {
            const full = path.join(__dirname, '..', '..', 'uploads', p.payslipPath.replace('/uploads/', ''));
            if (fs.existsSync(full)) fs.unlinkSync(full);
        }
        return res.status(200).json({ status: 200, message: 'Payroll deleted' });
    } catch (e) { return res.status(500).json({ status: 500, message: 'Internal server error' }); }
});

// Calendar
const calendarController = require('../controllers/calendar');
router.post('/calendar', roleCheck(['admin', 'hr']), calendarController.createEvent);
router.put('/calendar/:id', roleCheck(['admin', 'hr']), calendarController.updateEvent);
router.get('/calendar', calendarController.getEvents);
router.delete('/calendar/:id', roleCheck(['admin', 'hr']), calendarController.deleteEvent);

// Payslip Requests
const payslipRequestController = require('../controllers/payslipRequest');
router.post('/payslip-requests', payslipRequestController.requestPayslip);
router.get('/payslip-requests/me', payslipRequestController.getMyRequests);
router.get('/payslip-requests/all', roleCheck(['admin', 'hr']), payslipRequestController.getAllRequests);
router.put('/payslip-requests/:id/status', roleCheck(['admin', 'hr']), payslipRequestController.updateRequestStatus);

// Notifications
const notificationController = require('../controllers/notifications');
router.get('/notifications', notificationController.getMyNotifications);
router.put('/notifications/read-all', notificationController.markAllRead);

// Dashboard
const dashboardController = require('../controllers/dashboard');
router.get('/dashboard', dashboardController.getStats);

module.exports = router;
