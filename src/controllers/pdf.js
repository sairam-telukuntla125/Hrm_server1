const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const ALLOWED_TYPES = { 'offer-letters': true, 'payslips': true };

module.exports = {
    streamPdf: (req, res) => {
        const { type, filename } = req.params;

        // Validate token from query string (browser <a href> can't send headers)
        const token = req.query.token;
        if (!token) return res.status(401).json({ status: 401, message: 'Unauthorized' });
        try {
            jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        } catch {
            return res.status(401).json({ status: 401, message: 'Invalid or expired token' });
        }

        // Validate type and sanitize filename (no path traversal)
        if (!ALLOWED_TYPES[type] || filename.includes('..') || filename.includes('/') || !filename.endsWith('.pdf')) {
            return res.status(400).json({ status: 400, message: 'Invalid PDF request' });
        }

        const filePath = path.join(__dirname, '..', '..', 'uploads', type, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ status: 404, message: 'PDF not found' });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        fs.createReadStream(filePath).pipe(res);
    }
};
