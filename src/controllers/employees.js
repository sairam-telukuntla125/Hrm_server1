const Users = require('../models/Users');
const { createNotification } = require('../utils/notifications');

module.exports = {
    getAllEmployees: async (req, res) => {
        try {
            const employees = await Users.find({ deletedAt: null }).select('-password').populate('manager', 'name email').sort({ createdAt: -1 });
            return res.status(200).json({ status: 200, data: employees });
        } catch (error) {
            return res.status(500).json({ status: 500, message: 'Internal server error' });
        }
    },

    getMyTeam: async (req, res) => {
        try {
            const filter = {
                deletedAt: null,
                role: 'employee',
                _id: { $ne: req.user._id }
            };

            // Employees only receive a small, non-sensitive directory for
            // colleagues in their own department.
            if (req.user.department) filter.department = req.user.department;
            else return res.status(200).json({ status: 200, data: [] });

            const employees = await Users.find(filter)
                .select('name department designation role')
                .sort({ name: 1 })
                .limit(6);
            return res.status(200).json({ status: 200, data: employees });
        } catch (error) {
            return res.status(500).json({ status: 500, message: 'Internal server error' });
        }
    },

    getEmployeeById: async (req, res) => {
        try {
            const { id } = req.params;
            if (req.user.role === 'employee' && req.user._id.toString() !== id) {
                return res.status(403).json({ status: 403, message: 'Access denied' });
            }
            const employee = await Users.findById(id).select('-password').populate('manager', 'name email');
            if (!employee) return res.status(404).json({ status: 404, message: 'Employee not found' });
            return res.status(200).json({ status: 200, data: employee });
        } catch (error) {
            return res.status(500).json({ status: 500, message: 'Internal server error' });
        }
    },

    createEmployee: async (req, res) => {
        try {
            const { name, email, password, phoneNumber, department, designation, manager, doj, idempotencyKey } = req.body;
            const normalizedEmail = String(email || '').trim().toLowerCase();
            const normalizedName = String(name || '').trim();
            const normalizedDepartment = String(department || '').trim();
            const normalizedDesignation = String(designation || '').trim();

            if (!normalizedName || !normalizedEmail || !password || !normalizedDepartment || !normalizedDesignation) {
                return res.status(400).json({ status: 400, message: 'Name, email, password, department and designation are required' });
            }
            if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
                return res.status(400).json({ status: 400, message: 'Please enter a valid email address' });
            }
            if (String(password).length < 6) {
                return res.status(400).json({ status: 400, message: 'Temporary password must be at least 6 characters' });
            }
            if (idempotencyKey) {
                const previousRequest = await Users.findOne({ creationRequestId: idempotencyKey }).select('+creationRequestId');
                if (previousRequest) {
                    const employeeData = previousRequest.toObject();
                    delete employeeData.password;
                    delete employeeData.creationRequestId;
                    return res.status(200).json({ status: 200, message: 'Employee creation already completed', data: employeeData });
                }
            }
            const existing = await Users.findOne({ email: normalizedEmail });
            if (existing) return res.status(409).json({ status: 409, message: 'An employee with this email already exists' });

            const newEmployee = new Users({
                name: normalizedName,
                email: normalizedEmail,
                password,
                phoneNumber,
                role: 'employee',
                department: normalizedDepartment,
                designation: normalizedDesignation,
                manager,
                doj,
                isActive: true,
                creationRequestId: idempotencyKey || undefined,
                auditTrail: [{ action: 'created', modifiedBy: req.user._id, modifiedAt: new Date(), details: 'Employee created' }]
            });
            await newEmployee.save();
            const recipientRole = req.user.role === 'admin' ? 'hr' : 'admin';
            await createNotification({
                type: 'employee',
                title: 'New employee added',
                message: `${req.user.name} added ${newEmployee.name} as a new employee.`,
                link: '/admin/employees',
                recipientRoles: [recipientRole]
            });
            const employeeData = newEmployee.toObject();
            delete employeeData.password;
            delete employeeData.creationRequestId;
            return res.status(201).json({ status: 201, message: 'Employee created successfully', data: employeeData });
        } catch (error) {
            if (error?.code === 11000) {
                if (req.body?.idempotencyKey) {
                    const completedRequest = await Users.findOne({ creationRequestId: req.body.idempotencyKey }).select('+creationRequestId');
                    if (completedRequest) {
                        const employeeData = completedRequest.toObject();
                        delete employeeData.password;
                        delete employeeData.creationRequestId;
                        return res.status(200).json({ status: 200, message: 'Employee creation already completed', data: employeeData });
                    }
                }
                return res.status(409).json({ status: 409, message: 'An employee with this email already exists' });
            }
            return res.status(500).json({ status: 500, message: error.message || 'Internal server error' });
        }
    },

    updateEmployee: async (req, res) => {
        try {
            const { id } = req.params;
            const updates = { ...req.body };
            if (updates.password) {
                updates.password = updates.password;
            }
            delete updates._id;
            const employee = await Users.findById(id);
            if (!employee) return res.status(404).json({ status: 404, message: 'Employee not found' });

            const nextEmployee = await Users.findByIdAndUpdate(
                id,
                {
                    ...updates,
                    updatedAt: new Date(),
                    $push: {
                        auditTrail: {
                            action: 'updated',
                            modifiedBy: req.user._id,
                            modifiedAt: new Date(),
                            details: 'Employee updated by admin/hr'
                        }
                    }
                },
                { returnDocument: 'after' }
            ).select('-password').populate('manager', 'name email');

            return res.status(200).json({ status: 200, message: 'Employee updated', data: nextEmployee });
        } catch (error) {
            return res.status(500).json({ status: 500, message: error.message || 'Internal server error' });
        }
    },

    deleteEmployee: async (req, res) => {
        try {
            const { id } = req.params;
            if (req.user._id.toString() === id) {
                return res.status(400).json({ status: 400, message: 'You cannot delete your own administrator account' });
            }

            const employee = await Users.findById(id);
            if (!employee) return res.status(404).json({ status: 404, message: 'Employee not found' });

            const [Attendance, LeaveRequest, Payroll, PayslipRequest, CalendarEvent, Notification] = [
                require('../models/Attendance'),
                require('../models/LeaveRequest'),
                require('../models/Payroll'),
                require('../models/PayslipRequest'),
                require('../models/CalendarEvent'),
                require('../models/Notification')
            ];

            // A permanent deletion removes the user and their private HR data,
            // then removes their references from shared data.
            await Promise.all([
                Attendance.deleteMany({ userId: id }),
                LeaveRequest.deleteMany({ userId: id }),
                Payroll.deleteMany({ userId: id }),
                PayslipRequest.deleteMany({ userId: id }),
                CalendarEvent.updateMany({}, { $pull: { participants: id } }),
                CalendarEvent.updateMany({ relatedUserId: id }, { $unset: { relatedUserId: 1 } }),
                Notification.updateMany({}, { $pull: { recipientUsers: id, readBy: id } })
            ]);
            await Users.deleteOne({ _id: id });

            return res.status(200).json({ status: 200, message: 'Employee permanently deleted' });
        } catch (error) {
            console.error('Employee deletion failed:', error);
            return res.status(500).json({ status: 500, message: error.message || 'Unable to delete employee' });
        }
    }
};
