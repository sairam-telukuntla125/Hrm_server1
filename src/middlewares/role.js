const roleCheck = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ status: 401, message: 'User not authenticated' });
        }

        if (req.user.role === 'admin') {
            return next();
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ status: 403, message: 'Access denied. Insufficient permissions.' });
        }

        next();
    };
};

module.exports = roleCheck;
