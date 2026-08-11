require('dotenv').config();
const mongoose = require('mongoose');
const Users = require('./src/models/Users');

const seedAdmin = async () => {
    try {
        const dbUrl = process.env.ENVIRONMENT === 'DEVELOPMENT' ? process.env.DB_URL_DEV : process.env.DB_URL_PROD;
        await mongoose.connect(dbUrl);
        console.log("Connected to MongoDB");

        const existingAdmin = await Users.findOne({ email: 'admin@neuzen.ai' });
        if (existingAdmin) {
            console.log("Admin already exists!");
            process.exit(0);
        }

        const admin = new Users({
            name: 'Admin',
            email: 'admin@neuzen.ai',
            password: 'Password123!', // Will be hashed via pre-save middleware
            phoneNumber: '1234567890',
            role: 'admin'
        });

        await admin.save();
        console.log("Admin user seeded successfully. Login: admin@neuzen.ai / Password123!");
        process.exit(0);
    } catch (error) {
        console.error("Error seeding admin:", error);
        process.exit(1);
    }
};

seedAdmin();
