const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const Payroll = require('../models/Payroll');
const OfferLetter = require('../models/OfferLetter');
const { getDocumentDirectory } = require('../utils/documentStorage');

const ALLOWED_TYPES = { 'offer-letters': true, payslips: true };
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const writePdf = (filePath, draw) => new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const doc = new PDFDocument({ margin: 50 });
    const output = fs.createWriteStream(filePath);
    doc.pipe(output);
    output.once('finish', resolve);
    output.once('error', reject);
    doc.once('error', reject);
    draw(doc);
    doc.end();
});

const restoreMissingPdf = async (type, filename, filePath) => {
    const storedPath = `/uploads/${type}/${filename}`;

    if (type === 'offer-letters') {
        const offer = await OfferLetter.findOne({ pdfPath: storedPath });
        if (!offer) return false;
        await writePdf(filePath, (doc) => {
            doc.fontSize(25).text('NEUZEN AI', { align: 'center' });
            doc.moveDown();
            doc.fontSize(18).text('Offer Letter', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text(`Date: ${new Date(offer.createdAt || Date.now()).toLocaleDateString()}`);
            doc.moveDown();
            doc.text(`Dear ${offer.candidateName},`);
            doc.moveDown();
            doc.text(`We are pleased to offer you the position of ${offer.position} at NEUZEN AI.`);
            doc.text(`Your starting salary will be $${offer.salary} per annum.`);
            doc.moveDown();
            doc.text('Please sign and return this letter to accept the offer.');
            doc.moveDown(3);
            doc.text('Sincerely,');
            doc.text('HR Department, NEUZEN AI');
        });
        return true;
    }

    const payroll = await Payroll.findOne({ payslipPath: storedPath }).populate('userId', 'name department designation');
    if (!payroll) return false;
    const employee = payroll.userId || {};
    await writePdf(filePath, (doc) => {
        const line = () => doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke().moveDown(0.5);
        const row = (label, value) => doc.fontSize(11).font('Helvetica').text(`${label.padEnd(18)}: ${value}`);
        const monthName = MONTH_NAMES[Number(payroll.month) - 1] || payroll.month;
        const money = (value) => `$${Number(value || 0).toFixed(2)}`;

        doc.fontSize(22).font('Helvetica-Bold').text('NEUZEN AI HRMS', { align: 'center' });
        doc.fontSize(14).font('Helvetica').text('Payslip', { align: 'center' });
        doc.text(`${monthName} ${payroll.year}`, { align: 'center' });
        doc.moveDown(); line();
        row('Employee Name', employee.name || 'N/A');
        row('Employee ID', payroll.employeeId || 'N/A');
        row('Department', payroll.snapshot?.department || employee.department || 'N/A');
        row('Designation', payroll.snapshot?.designation || employee.designation || 'N/A');
        doc.moveDown(); line();
        row('Present Days', String(payroll.presentDays ?? 0));
        row('Leave Days', String(payroll.leaveDays ?? 0));
        row('Absent Days', String(payroll.absentDays ?? 0));
        row('Overtime Hrs', Number(payroll.overtimeHours || 0).toFixed(2));
        doc.moveDown(); line();
        row('Basic Salary', money(payroll.basic));
        row('Allowances', money(payroll.allowances));
        row('Overtime Pay', money(payroll.overtimePay));
        row('Gross Salary', money(payroll.grossSalary));
        row('Deductions', money(payroll.deductions));
        doc.moveDown(); line();
        doc.fontSize(14).font('Helvetica-Bold').text(`Net Salary         : ${money(payroll.netSalary)}`);
    });
    return true;
};

module.exports = {
    streamPdf: async (req, res) => {
        try {
            const { type, filename } = req.params;
            if (!ALLOWED_TYPES[type] || !filename || filename.includes('..') || filename.includes('/') || filename.includes('\\') || !filename.endsWith('.pdf')) {
                return res.status(400).json({ status: 400, message: 'Invalid PDF request' });
            }

            const uploadDirectory = path.resolve(getDocumentDirectory(type));
            const filePath = path.resolve(uploadDirectory, filename);
            const relativePath = path.relative(uploadDirectory, filePath);
            if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
                return res.status(400).json({ status: 400, message: 'Invalid PDF request' });
            }

            if (!fs.existsSync(filePath)) {
                const restored = await restoreMissingPdf(type, filename, filePath);
                if (!restored) return res.status(404).json({ status: 404, message: 'PDF document not found' });
            }

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
            fs.createReadStream(filePath).once('error', () => res.destroy()).pipe(res);
        } catch (error) {
            console.error('PDF stream error:', error);
            return res.status(500).json({ status: 500, message: 'Unable to prepare PDF document' });
        }
    }
};
