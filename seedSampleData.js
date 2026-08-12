require('dotenv').config();
const mongoose = require('mongoose');
const Users = require('./src/models/Users');
const Attendance = require('./src/models/Attendance');
const CalendarEvent = require('./src/models/CalendarEvent');

const seedSampleData = async () => {
    try {
        const dbUrl = process.env.ENVIRONMENT === 'DEVELOPMENT' ? process.env.DB_URL_DEV : process.env.DB_URL_PROD;
        await mongoose.connect(dbUrl);
        console.log('Connected to MongoDB');

        // Get all non-admin users
        const users = await Users.find({ role: { $in: ['hr', 'employee'] } }).limit(6);
        if (users.length === 0) {
            console.log('No users found. Run seedData.js first.');
            process.exit(1);
        }

        // ── ATTENDANCE: past 30 days for each user ──────────────────────────
        const existingCount = await Attendance.countDocuments();
        if (existingCount < 10) {
            const attendanceRecords = [];
            const today = new Date();
            let count = 0;

            outer:
            for (let daysAgo = 15; daysAgo >= 1; daysAgo--) {
                const d = new Date(today);
                d.setDate(today.getDate() - daysAgo);
                const dow = d.getDay();
                if (dow === 0 || dow === 6) continue;

                for (const user of users) {
                    if (count >= 15) break outer;

                    const checkInHour = 8 + Math.floor(Math.random() * 2);
                    const checkInMin = Math.floor(Math.random() * 60);
                    const checkIn = new Date(d);
                    checkIn.setHours(checkInHour, checkInMin, 0, 0);

                    const workedHours = 7 + Math.random() * 3;
                    const checkOut = new Date(checkIn.getTime() + workedHours * 3600000);
                    const status = workedHours < 4 ? 'Half Day' : 'Present';

                    attendanceRecords.push({ userId: user._id, date: checkIn, checkIn, checkOut, status });
                    count++;
                }
            }

            await Attendance.insertMany(attendanceRecords);
            console.log(`Seeded ${attendanceRecords.length} attendance records`);
        } else {
            console.log('Attendance records already exist, skipping.');
        }

        // ── CALENDAR: holidays + meetings ───────────────────────────────────
        const now = new Date();
        const currentYear = now.getFullYear();

        // Check if holidays already seeded
        const holidayCount = await CalendarEvent.countDocuments({ type: 'holiday' });
        if (holidayCount < 5) {
            const holidays = [
                // Previous months
                { title: 'New Year\'s Day', date: new Date(`${currentYear}-01-01`), description: 'New Year public holiday' },
                { title: 'Republic Day', date: new Date(`${currentYear}-01-26`), description: 'National holiday' },
                { title: 'Holi', date: new Date(`${currentYear}-03-14`), description: 'Festival of Colors' },
                { title: 'Good Friday', date: new Date(`${currentYear}-04-18`), description: 'Public holiday' },
                { title: 'Labour Day', date: new Date(`${currentYear}-05-01`), description: 'International Workers Day' },
                { title: 'Eid al-Adha', date: new Date(`${currentYear}-06-07`), description: 'Public holiday' },
                { title: 'Independence Day', date: new Date(`${currentYear}-08-15`), description: 'National Independence Day' },
                // Current month
                { title: 'Company Foundation Day', date: new Date(currentYear, now.getMonth(), 10), description: 'Company anniversary celebration' },
                // Next month
                { title: 'Gandhi Jayanti', date: new Date(`${currentYear}-10-02`), description: 'National holiday' },
                { title: 'Dussehra', date: new Date(`${currentYear}-10-02`), description: 'Festival holiday' },
                { title: 'Diwali', date: new Date(`${currentYear}-10-20`), description: 'Festival of Lights - public holiday' },
                { title: 'Diwali Holiday', date: new Date(`${currentYear}-10-21`), description: 'Diwali extended holiday' },
                { title: 'Christmas Day', date: new Date(`${currentYear}-12-25`), description: 'Public holiday' },
                { title: 'New Year Eve', date: new Date(`${currentYear}-12-31`), description: 'Company holiday' },
            ];

            const holidayDocs = holidays.map(h => ({
                title: h.title,
                description: h.description,
                type: 'holiday',
                date: h.date,
                endDate: h.date,
                visibility: 'all',
                status: 'scheduled',
                priority: 'high'
            }));

            await CalendarEvent.insertMany(holidayDocs);
            console.log(`Seeded ${holidayDocs.length} holidays`);
        } else {
            console.log('Holidays already exist, skipping.');
        }

        // ── MEETINGS ────────────────────────────────────────────────────────
        const meetingCount = await CalendarEvent.countDocuments({ type: 'meeting' });
        if (meetingCount < 3) {
            const admin = await Users.findOne({ role: 'admin' });
            const createdBy = admin ? admin._id : users[0]._id;

            const meetings = [
                // Past meetings
                {
                    title: 'Q2 Performance Review',
                    description: 'Quarterly performance review for all departments',
                    date: new Date(now.getFullYear(), now.getMonth() - 1, 15, 10, 0),
                    endDate: new Date(now.getFullYear(), now.getMonth() - 1, 15, 12, 0),
                    startTime: '10:00',
                    endTime: '12:00',
                    status: 'completed'
                },
                {
                    title: 'Team Sync – Engineering',
                    description: 'Weekly engineering team sync',
                    date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 9, 30),
                    endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 10, 30),
                    startTime: '09:30',
                    endTime: '10:30',
                    status: 'completed'
                },
                // Upcoming meetings
                {
                    title: 'All Hands Meeting',
                    description: 'Monthly all-hands company meeting. Agenda: Q3 goals, new hires, announcements.',
                    date: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 11, 0),
                    endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 12, 30),
                    startTime: '11:00',
                    endTime: '12:30',
                    status: 'scheduled'
                },
                {
                    title: 'HR Policy Update Briefing',
                    description: 'Briefing on updated leave and attendance policies for all employees.',
                    date: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5, 14, 0),
                    endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5, 15, 0),
                    startTime: '14:00',
                    endTime: '15:00',
                    status: 'scheduled'
                },
                {
                    title: 'Product Roadmap Discussion',
                    description: 'Engineering and product team roadmap planning for next quarter.',
                    date: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 8, 10, 0),
                    endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 8, 11, 30),
                    startTime: '10:00',
                    endTime: '11:30',
                    status: 'scheduled'
                },
                {
                    title: 'Onboarding Orientation',
                    description: 'Orientation session for new joiners this month.',
                    date: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 10, 9, 0),
                    endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 10, 10, 0),
                    startTime: '09:00',
                    endTime: '10:00',
                    status: 'scheduled'
                },
                {
                    title: 'Q3 Review Planning',
                    description: 'Planning session for Q3 performance reviews.',
                    date: new Date(now.getFullYear(), now.getMonth() + 1, 5, 10, 0),
                    endDate: new Date(now.getFullYear(), now.getMonth() + 1, 5, 11, 0),
                    startTime: '10:00',
                    endTime: '11:00',
                    status: 'scheduled'
                },
            ];

            const meetingDocs = meetings.map(m => ({
                ...m,
                type: 'meeting',
                visibility: 'all',
                priority: 'medium',
                createdBy
            }));

            await CalendarEvent.insertMany(meetingDocs);
            console.log(`Seeded ${meetingDocs.length} meetings`);
        } else {
            console.log('Meetings already exist, skipping.');
        }

        console.log('Sample data seeded successfully!');
        process.exit(0);
    } catch (e) {
        console.error('Seed error:', e);
        process.exit(1);
    }
};

seedSampleData();
