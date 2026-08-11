/* Plugins. */
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

/* Helpers. */
const { jsonWebToken } = require('../config');

const userSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true
    },

    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },

    password: {
        type: String,
        required: true
    },

    phoneNumber: {
        type: String,
        required: false
    },

    department: {
        type: String,
        required: false
    },

    designation: {
        type: String,
        required: false
    },

    salary: {
        type: Number,
        default: 0
    },

    allowances: {
        type: Number,
        default: 0
    },

    manager: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users',
        default: null
    },

    doj: {
        type: Date,
        default: null
    },

    isActive: {
        type: Boolean,
        default: true
    },

    createdAt: {
        type: Date,
        default: Date.now
    },

    role: {
        type: String,
        enum: ['admin', 'hr', 'employee'],
        default: 'employee'
    },

    updatedAt: {
        type: Date,
        default: null
    },

    deletedAt: {
        type: Date,
        default: null
    },

    // Lets the API safely recognise a retry of the exact same employee-creation request.
    creationRequestId: {
        type: String,
        unique: true,
        sparse: true,
        select: false
    },

    passwordResetTokenHash: {
        type: String,
        select: false
    },

    passwordResetExpires: {
        type: Date,
        select: false
    },

    auditTrail: [{
        action: { type: String, required: true },
        modifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Users' },
        modifiedAt: { type: Date, default: Date.now },
        details: { type: String, default: '' }
    }]

});

userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

userSchema.pre('findOneAndUpdate', function (next) {
    this._update = this._update || {};
    if (this._update.password) {
        const salt = bcrypt.genSaltSync(10);
        this._update.password = bcrypt.hashSync(this._update.password, salt);
    }
    next();
});

/* Check password. */
userSchema.methods.comparePassword = async function (enteredPassword) {
    return bcrypt.compare(enteredPassword, this.password);
};

/* Create JSON web token. */
userSchema.methods.generateToken = async function () {
    const token = jwt.sign({
        _id: this._id,
        name: this.name,
        email: this.email,
        phoneNumber: this.phoneNumber,
        role: this.role,
        department: this.department,
        designation: this.designation,
        createdAt: this.createdAt
    }, jsonWebToken?.accessToken, { expiresIn: '1d' });
    return token;
};

const Users = mongoose.model('Users', userSchema, 'Users');
module.exports = Users;
