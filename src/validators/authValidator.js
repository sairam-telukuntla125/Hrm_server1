const { z } = require('zod');

const loginSchema = z.object({
    body: z.object({
        email: z.string().email("Invalid email address"),
        password: z.string().min(6, "Password must be at least 6 characters")
    })
});

const forgotPasswordSchema = z.object({
    body: z.object({
        email: z.string().email('Please enter a valid email address')
    })
});

const resetPasswordSchema = z.object({
    body: z.object({
        token: z.string().min(1, 'Reset token is required'),
        password: z.string().min(6, 'Password must be at least 6 characters')
    })
});

module.exports = {
    loginSchema,
    forgotPasswordSchema,
    resetPasswordSchema
};
