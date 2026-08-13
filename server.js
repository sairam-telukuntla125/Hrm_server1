/* Plugins. */
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

/* Helpers. */
const { port, db } = require('./src/config');
const publicRouted = require('./src/routes/publicRoutes');
const authentication = require('./src/middlewares/authentication');
const { getMe } = require('./src/controllers/auth');
const { storageRoot } = require('./src/utils/documentStorage');

/* Variables. */
const app = express();
const defaultClientOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://hrm-browser-git-main-hrm14.vercel.app'
];
const configuredOrigins = (process.env.CLIENT_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
const allowedOrigins = new Set([...defaultClientOrigins, ...configuredOrigins]);
const isProjectVercelOrigin = (origin) => /^https:\/\/hrm-browser(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(origin);

const corsOptions = {
    origin(origin, callback) {
        const normalizedOrigin = origin?.replace(/\/$/, '');
        if (!normalizedOrigin || allowedOrigins.has(normalizedOrigin) || isProjectVercelOrigin(normalizedOrigin)) {
            return callback(null, true);
        }
        const error = new Error(`Origin ${origin} is not allowed by CORS`);
        error.status = 403;
        return callback(error);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false
};

/* Middlewares. */
app.use(helmet());
app.set('trust proxy', 1);
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000, standardHeaders: true, legacyHeaders: false });
app.use(limiter);
app.use(express.json({ limit: '2mb' }));

// FIX: '(.*)' is no longer accepted as a path string by the path-to-regexp
// version bundled with newer express/router releases (it throws
// "PathError: Unexpected ( at index 0"). app.use(cors(corsOptions)) below
// already handles preflight OPTIONS requests globally, so the explicit
// app.options('(.*)', ...) call was redundant anyway - just remove it.
app.use(cors(corsOptions));

app.use('/uploads', express.static(storageRoot));

// Used by deployment platforms and load balancers. It never depends on auth.
app.get('/health', (req, res) => {
    const connected = mongoose.connection.readyState === 1;
    res.status(connected ? 200 : 503).json({ status: connected ? 'ok' : 'degraded', database: connected ? 'connected' : 'disconnected' });
});

/* Route middlewares. */
app.use('/api/v1/auth', publicRouted);
const protectedRoutes = require('./src/routes/protectedRoutes');
app.use('/api/v1', protectedRoutes);

const authRehydrateRouter = express.Router();
authRehydrateRouter.use(authentication);
authRehydrateRouter.get('/me', getMe);
app.use('/api/v1/auth', authRehydrateRouter);
app.use('/api/auth', authRehydrateRouter);
app.use('/api', authRehydrateRouter);

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({ status: err.status || 500, message: err.message || 'Internal Server Error' });
});

let server;
let reconnectTimer;
let isConnecting = false;

const startServer = () => {
    if (server) return;
    server = app.listen(port, () => {
        console.log(`The server is running in the port : ${port}`);
    });
    server.on('error', (error) => {
        console.error(`HTTP server error: ${error.message}`);
    });
};

const scheduleReconnect = () => {
    if (reconnectTimer || isConnecting || mongoose.connection.readyState === 1) return;
    console.log('Retrying MongoDB connection in 5 seconds...');
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectMongo();
    }, 5000);
};

const connectMongo = async () => {
    if (isConnecting) return;

    if (!db?.url) {
        console.warn('MongoDB URL is not configured. Starting server without database connection.');
        startServer();
        return;
    }

    if (mongoose.connection.readyState === 1) {
        startServer();
        return;
    }

    let shouldRetry = false;
    try {
        isConnecting = true;
        await mongoose.connect(db.url, {
            serverSelectionTimeoutMS: 5000,
            autoIndex: true,
        });
        console.log('MongoDB connected.');
        startServer();
    } catch (error) {
        console.error('MongoDB connection issue:', error.message);
        shouldRetry = true;
    } finally {
        isConnecting = false;
        if (shouldRetry) scheduleReconnect();
    }
};

mongoose.connection.on('error', (error) => {
    console.error('MongoDB runtime error:', error.message);
});

mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected. Retrying connection...');
    scheduleReconnect();
});

const shutdown = (signal) => {
    console.log(`${signal} received. Closing HTTP server and MongoDB connection...`);
    if (!server) return mongoose.connection.close().finally(() => process.exit(0));
    server.close(() => mongoose.connection.close().finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10000).unref();
};

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});

connectMongo();
