const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const OfferLetter = require('../models/OfferLetter');
const Users = require('../models/Users');
const { createNotification } = require('../utils/notifications');

module.exports = {
    onboardEmployee: async (req, res) => {
        try {
            const { name, email, password, department, designation, doj } = req.body;
            if (!name || !email || !password || !department || !designation) {
                return res.status(400).json({ status: 400, message: 'name, email, password, department and designation are required' });
            }
            if (String(password).length < 6) {
                return res.status(400).json({ status: 400, message: 'Temporary password must be at least 6 characters' });
            }
            const normalizedEmail = String(email || '').trim().toLowerCase();
            const existing = await Users.findOne({ email: normalizedEmail });
            if (existing) return res.status(409).json({ status: 409, message: 'An employee with this email already exists' });

            const employee = await Users.create({
                name, email: normalizedEmail, password, department, designation, role: 'employee', doj: doj || new Date(), isActive: true,
                auditTrail: [{ action: 'onboarded', modifiedBy: req.user._id, modifiedAt: new Date(), details: 'Employee onboarded by HRMS' }]
            });
            await createNotification({
                type: 'onboarding', title: 'Welcome to NEUZEN AI',
                message: `Your employee profile has been created. Welcome aboard, ${employee.name}!`,
                link: '/employee', recipientUsers: [employee._id]
            });
            const recipientRole = req.user.role === 'admin' ? 'hr' : 'admin';
            await createNotification({
                type: 'employee',
                title: 'New employee onboarded',
                message: `${req.user.name} onboarded ${employee.name} as a new employee.`,
                link: '/admin/employees',
                recipientRoles: [recipientRole]
            });
            const employeeData = employee.toObject();
            delete employeeData.password;
            return res.status(201).json({ status: 201, message: 'Employee onboarded successfully', data: employeeData });
        } catch (error) {
            if (error?.code === 11000) {
                return res.status(409).json({ status: 409, message: 'An employee with this email already exists' });
            }
            return res.status(500).json({ status: 500, message: error.message || 'Unable to onboard employee' });
        }
    },

    generateOfferLetter: async (req, res) => {
        try {
            const { candidateName, candidateEmail, position, salary } = req.body;
            
            // Create uploads directory if it doesn't exist
            const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'offer-letters');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const fileName = `offer_letter_${Date.now()}.pdf`;
            const pdfPath = path.join(uploadDir, fileName);
            const relativePath = `/uploads/offer-letters/${fileName}`;

            // Generate PDF
            const doc = new PDFDocument();
            doc.pipe(fs.createWriteStream(pdfPath));

            doc.fontSize(25).text('NEUZEN AI', { align: 'center' });
            doc.moveDown();
            doc.fontSize(18).text('Offer Letter', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text(`Date: ${new Date().toLocaleDateString()}`);
            doc.moveDown();
            doc.text(`Dear ${candidateName},`);
            doc.moveDown();
            doc.text(`We are pleased to offer you the position of ${position} at NEUZEN AI.`);
            doc.text(`Your starting salary will be $${salary} per annum.`);
            doc.moveDown();
            doc.text('Please sign and return this letter to accept the offer.');
            doc.moveDown(3);
            doc.text('Sincerely,');
            doc.text('HR Department, NEUZEN AI');
            
            doc.end();

            // Save to DB
            const offerLetter = new OfferLetter({
                candidateName,
                candidateEmail,
                position,
                salary,
                pdfPath: relativePath,
                createdBy: req.user._id
            });
            await offerLetter.save();

            return res.status(201).json({ status: 201, message: "Offer letter generated", data: offerLetter });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ status: 500, message: "Internal server error" });
        }
    },

    getOfferLetters: async (req, res) => {
        try {
            const letters = await OfferLetter.find().populate('createdBy', 'name email');
            return res.status(200).json({ status: 200, data: letters });
        } catch (error) {
            return res.status(500).json({ status: 500, message: "Internal server error" });
        }
    }
};
