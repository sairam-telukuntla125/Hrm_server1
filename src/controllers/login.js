/* Models. */
const Users = require("../models/Users")
const jwt = require('jsonwebtoken');
const { jsonWebToken } = require('../config');

/* Helpers. */

module.exports = {
    login: async (req, res) => {
        try {
            const { email, password } = req.body;
            const normalizedEmail = String(email || '').trim().toLowerCase();
            
            const user = await Users.findOne({ email: normalizedEmail, deletedAt: null });
            if (!user) {
                return res.status(401).json({ status: 401, message: "Invalid credentials" });
            }

            const isMatch = await user.comparePassword(password);
            if (!isMatch) {
                return res.status(401).json({ status: 401, message: "Invalid credentials" });
            }

            const accessToken = await user.generateToken();
            const refreshToken = jwt.sign({ _id: user._id }, jsonWebToken.refreshToken, { expiresIn: '7d' });

            return res.status(200).json({
                status: 200,
                message: "Login successful",
                data: {
                    user: {
                        _id: user._id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        department: user.department,
                        designation: user.designation,
                        salary: user.salary,
                        allowances: user.allowances
                    },
                    accessToken,
                    refreshToken
                }
            });

        } catch (error) { 
            console.error(error);
            return res.status(500).json({ status: 500, message: `Something went wrong in login : ${error.message}` });
        }
    }
}
