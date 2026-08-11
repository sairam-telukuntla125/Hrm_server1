const mongoose = require('mongoose');

const offerLetterSchema = new mongoose.Schema({
    candidateName: { type: String, required: true },
    candidateEmail: { type: String, required: true },
    position: { type: String, required: true },
    salary: { type: Number, required: true },
    status: { type: String, enum: ['Pending', 'Accepted', 'Rejected'], default: 'Pending' },
    pdfPath: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true }
}, { timestamps: true });

module.exports = mongoose.model('OfferLetter', offerLetterSchema, 'OfferLetters');
