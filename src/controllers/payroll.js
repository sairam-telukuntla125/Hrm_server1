const Payroll = require('../models/Payroll');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const Users = require('../models/Users');

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const getMonthDateRange = (year, month) => ({
    start: new Date(year, month - 1, 1, 0, 0, 0, 0),
    end:   new Date(year, month,     0, 23, 59, 59, 999)
});

const computePayrollBreakdown = async (userId, monthNumber, yearNumber, overrides = {}) => {
    const user = await Users.findById(userId);
    if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

    const { start, end } = getMonthDateRange(yearNumber, monthNumber);

    const [attendanceRecords, approvedLeaves] = await Promise.all([
        Attendance.find({ userId, date: { $gte: start, $lte: end } }).sort({ date: 1 }),
        LeaveRequest.find({ userId, status: 'Approved', startDate: { $lte: end }, endDate: { $gte: start } })
    ]);

    let presentDays = 0, leaveDays = 0, absentDays = 0, overtimeHours = 0, totalWorkingDays = 0;
    const monthDayCount = new Date(yearNumber, monthNumber, 0).getDate();

    for (let i = 1; i <= monthDayCount; i++) {
        const date = new Date(yearNumber, monthNumber - 1, i, 12, 0, 0, 0);
        if (date.getDay() === 0 || date.getDay() === 6) continue;
        totalWorkingDays++;

        const hasLeave = approvedLeaves.some(l => {
            const ls = new Date(l.startDate); ls.setHours(0, 0, 0, 0);
            const le = new Date(l.endDate);   le.setHours(23, 59, 59, 999);
            return date >= ls && date <= le;
        });
        if (hasLeave) { leaveDays++; continue; }

        const att = attendanceRecords.find(r => new Date(r.date).toDateString() === date.toDateString());
        if (att?.checkIn) {
            presentDays++;
            if (att.checkOut) {
                const hrs = (new Date(att.checkOut) - new Date(att.checkIn)) / 3600000;
                if (hrs > 8) overtimeHours += hrs - 8;
            }
        } else {
            absentDays++;
        }
    }

    const basicSalary  = overrides.basic        != null ? Number(overrides.basic)        : (user.salary     || 0);
    const allowanceVal = overrides.allowances   != null ? Number(overrides.allowances)   : (user.allowances || 0);
    const deductionVal = overrides.deductions   != null ? Number(overrides.deductions)   : 0;
    const bonusVal     = overrides.bonus        != null ? Number(overrides.bonus)        : 0;
    const overtimeRate = overrides.overtimeRate != null ? Number(overrides.overtimeRate) : 15;

    const overtimePay = parseFloat((overtimeHours * overtimeRate).toFixed(2));
    const grossSalary = parseFloat((basicSalary + allowanceVal + overtimePay + bonusVal).toFixed(2));
    const netSalary   = parseFloat((grossSalary - deductionVal).toFixed(2));

    return {
        user, totalWorkingDays, presentDays, leaveDays, absentDays,
        overtimeHours: parseFloat(overtimeHours.toFixed(2)),
        overtimeRate, overtimePay, basicSalary, allowanceVal, deductionVal, bonusVal, grossSalary, netSalary
    };
};

module.exports = {
    previewPayroll: async (req, res) => {
        try {
            const { userId, month, year, basic, allowances, deductions, bonus, overtimeRate } = req.query;
            const monthNumber = Number(month);
            const yearNumber  = Number(year);
            if (!userId) return res.status(400).json({ status: 400, message: 'userId is required' });
            if (!monthNumber || monthNumber < 1 || monthNumber > 12 || !yearNumber) {
                return res.status(400).json({ status: 400, message: 'Valid month (1-12) and year are required' });
            }

            const duplicate  = await Payroll.findOne({ userId, month: monthNumber, year: yearNumber });
            const breakdown  = await computePayrollBreakdown(userId, monthNumber, yearNumber, { basic, allowances, deductions, bonus, overtimeRate });
            const { user, ...rest } = breakdown;

            return res.status(200).json({
                status: 200,
                data: {
                    ...rest,
                    employeeId:  user._id.toString().slice(-6).toUpperCase(),
                    name:        user.name,
                    email:       user.email,
                    department:  user.department  || 'N/A',
                    designation: user.designation || 'N/A',
                    month: monthNumber,
                    year:  yearNumber,
                    monthName:   MONTH_NAMES[monthNumber - 1],
                    isDuplicate: !!duplicate
                }
            });
        } catch (error) {
            const status = error.status || 500;
            return res.status(status).json({ status, message: error.message || 'Internal server error' });
        }
    },

    generatePayroll: async (req, res) => {
        try {
            const { userId, month, year, basic, allowances, deductions, bonus, overtimeRate } = req.body;
            const monthNumber = Number(month);
            const yearNumber  = Number(year);

            if (!userId) return res.status(400).json({ status: 400, message: 'userId is required' });
            if (!monthNumber || monthNumber < 1 || monthNumber > 12 || !yearNumber) {
                return res.status(400).json({ status: 400, message: 'Valid month (1-12) and year are required' });
            }

            const existing = await Payroll.findOne({ userId, month: monthNumber, year: yearNumber });
            if (existing) {
                return res.status(409).json({ status: 409, message: `Payroll for ${MONTH_NAMES[monthNumber - 1]} ${yearNumber} already processed for this employee` });
            }

            const b    = await computePayrollBreakdown(userId, monthNumber, yearNumber, { basic, allowances, deductions, bonus, overtimeRate });
            const { user } = b;

            const uploadDir    = path.join(__dirname, '..', '..', 'uploads', 'payslips');
            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

            const fileName     = `payslip_${userId}_${monthNumber}_${yearNumber}.pdf`;
            const pdfPath      = path.join(uploadDir, fileName);
            const relativePath = `/uploads/payslips/${fileName}`;

            await new Promise((resolve, reject) => {
                const doc    = new PDFDocument({ margin: 50 });
                const stream = fs.createWriteStream(pdfPath);
                doc.pipe(stream);
                stream.on('finish', resolve);
                stream.on('error', reject);

                const line = () => doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke().moveDown(0.5);
                const row  = (label, value) => doc.fontSize(11).font('Helvetica').text(`${label.padEnd(18)}: ${value}`);

                doc.fontSize(22).font('Helvetica-Bold').text('NEUZEN AI HRMS', { align: 'center' });
                doc.fontSize(14).font('Helvetica').text('Payslip', { align: 'center' });
                doc.text(`${MONTH_NAMES[monthNumber - 1]} ${yearNumber}`, { align: 'center' });
                doc.moveDown(); line();

                row('Employee Name',  user.name);
                row('Employee ID',    user._id.toString().slice(-6).toUpperCase());
                row('Department',     user.department  || 'N/A');
                row('Designation',    user.designation || 'N/A');
                doc.moveDown(); line();

                row('Working Days',  String(b.totalWorkingDays));
                row('Present Days',  String(b.presentDays));
                row('Leave Days',    String(b.leaveDays));
                row('Absent Days',   String(b.absentDays));
                row('Overtime Hrs',  b.overtimeHours.toFixed(2));
                row('Overtime Rate', `$${b.overtimeRate.toFixed(2)}/hr`);
                doc.moveDown(); line();

                row('Basic Salary',  `$${b.basicSalary.toFixed(2)}`);
                row('Allowances',    `$${b.allowanceVal.toFixed(2)}`);
                row('Bonus',         `$${b.bonusVal.toFixed(2)}`);
                row('Overtime Pay',  `$${b.overtimePay.toFixed(2)}`);
                row('Gross Salary',  `$${b.grossSalary.toFixed(2)}`);
                row('Deductions',    `$${b.deductionVal.toFixed(2)}`);
                doc.moveDown(); line();

                doc.fontSize(14).font('Helvetica-Bold').text(`Net Salary         : $${b.netSalary.toFixed(2)}`);
                doc.end();
            });

            const payroll = new Payroll({
                userId,
                employeeId:    user._id.toString().slice(-6).toUpperCase(),
                month:         monthNumber,
                year:          yearNumber,
                basic:         b.basicSalary,
                allowances:    b.allowanceVal,
                deductions:    b.deductionVal,
                grossSalary:   b.grossSalary,
                overtimeHours: b.overtimeHours,
                overtimePay:   b.overtimePay,
                presentDays:   b.presentDays,
                absentDays:    b.absentDays,
                leaveDays:     b.leaveDays,
                netSalary:     b.netSalary,
                payslipPath:   relativePath,
                snapshot: {
                    bonus:           b.bonusVal,
                    overtimeRate:    b.overtimeRate,
                    totalWorkingDays: b.totalWorkingDays,
                    department:      user.department,
                    designation:     user.designation
                }
            });
            await payroll.save();

            return res.status(201).json({ status: 201, message: 'Payroll generated', data: payroll });
        } catch (error) {
            const status = error.status || 500;
            return res.status(status).json({ status, message: error.message || 'Internal server error' });
        }
    },

    getMyPayslips: async (req, res) => {
        try {
            const payslips = await Payroll.find({ userId: req.user._id }).sort({ year: -1, month: -1 });
            return res.status(200).json({ status: 200, data: payslips });
        } catch (error) {
            return res.status(500).json({ status: 500, message: 'Internal server error' });
        }
    },

    getAllPayroll: async (req, res) => {
        try {
            const payrolls = await Payroll.find()
                .populate('userId', 'name email department designation')
                .sort({ year: -1, month: -1 });
            return res.status(200).json({ status: 200, data: payrolls });
        } catch (error) {
            return res.status(500).json({ status: 500, message: 'Internal server error' });
        }
    }
};
