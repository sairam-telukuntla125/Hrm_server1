const jwt = require('jsonwebtoken');
const { jsonWebToken } = require('../config');
const Users = require('../models/Users');

const authentication = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ status: 401, message: "No token provided" });
        }
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, jsonWebToken.accessToken);
        const user = await Users.findById(decoded._id).select('-password');
        if (!user) {
            return res.status(401).json({ status: 401, message: "User not found" });
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ status: 401, message: "Token expired" });
        }
        return res.status(401).json({ status: 401, message: "Authentication failed" });
    }
};

module.exports = authentication;