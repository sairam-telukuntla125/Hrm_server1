require('dotenv').config();
const mongoose = require('mongoose');
const Users = require('./src/models/Users');
const CalendarEvent = require('./src/models/CalendarEvent');
const LeaveRequest = require('./src/models/LeaveRequest');

const seedData = async () => {
    try {
        const dbUrl = process.env.ENVIRONMENT === 'DEVELOPMENT' ? process.env.DB_URL_DEV : process.env.DB_URL_PROD;
        await mongoose.connect(dbUrl);
        
        // HR 1
        let hr1 = await Users.findOne({ email: 'hr1@neuzen.ai' });
        if(!hr1) {
            hr1 = new Users({ name: 'Sarah HR', email: 'hr1@neuzen.ai', password: 'Password123!', role: 'hr', department: 'Human Resources', designation: 'HR Manager' });
            await hr1.save();
        }
        
        // HR 2
        let hr2 = await Users.findOne({ email: 'hr2@neuzen.ai' });
        if(!hr2) {
            hr2 = new Users({ name: 'Mike HR', email: 'hr2@neuzen.ai', password: 'Password123!', role: 'hr', department: 'Human Resources', designation: 'HR Assistant' });
            await hr2.save();
        }
        
        // Employee 1
        let emp1 = await Users.findOne({ email: 'emp1@neuzen.ai' });
        if(!emp1) {
            emp1 = new Users({ name: 'Alice Dev', email: 'emp1@neuzen.ai', password: 'Password123!', role: 'employee', department: 'Engineering', designation: 'SDE I' });
            await emp1.save();
        }

        // Employee 2
        let emp2 = await Users.findOne({ email: 'emp2@neuzen.ai' });
        if(!emp2) {
            emp2 = new Users({ name: 'Bob Dev', email: 'emp2@neuzen.ai', password: 'Password123!', role: 'employee', department: 'Engineering', designation: 'SDE II' });
            await emp2.save();
        }

        // Seed some calendar events
        let eventCount = await CalendarEvent.countDocuments();
        if(eventCount === 0) {
            await CalendarEvent.create([
                { title: 'Company Retreat', date: new Date(new Date().setDate(new Date().getDate() + 5)), type: 'holiday', visibility: 'all' },
                { title: 'Independence Day', date: new Date('2026-08-15'), type: 'holiday', visibility: 'all' },
                { title: 'Alice Onboarding', date: new Date(new Date().setDate(new Date().getDate() - 1)), type: 'onboarding', visibility: 'all', relatedUserId: emp1._id }
            ]);
        }

        // Seed a leave for the calendar
        let leaveCount = await LeaveRequest.countDocuments();
        if(leaveCount === 0) {
            const leave = new LeaveRequest({
                userId: emp2._id,
                type: 'Sick',
                startDate: new Date(),
                endDate: new Date(new Date().setDate(new Date().getDate() + 2)),
                reason: 'Flu',
                status: 'Approved',
                approvedBy: hr1._id
            });
            await leave.save();
            
            // Mirror leave in calendar
            await CalendarEvent.create({
                title: 'Bob Sick Leave',
                date: new Date(),
                type: 'leave',
                visibility: 'all',
                relatedUserId: emp2._id
            });
        }

        console.log("Seeded successfully");
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
seedData();
