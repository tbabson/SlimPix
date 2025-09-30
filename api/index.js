import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

const app = express();

// Basic middleware (no external imports yet)
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Test route BEFORE importing anything else
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Basic server is working',
        env: {
            hasMongoUrl: !!process.env.MONGODB_URL,
            nodeEnv: process.env.NODE_ENV
        }
    });
});

// Cached MongoDB connection
let isConnected = false;

const connectDB = async () => {
    if (isConnected && mongoose.connection.readyState === 1) {
        return;
    }

    if (!process.env.MONGODB_URL) {
        throw new Error('MONGODB_URL environment variable is not defined');
    }

    try {
        await mongoose.connect(process.env.MONGODB_URL, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        isConnected = true;
        console.log('MongoDB connected');
    } catch (err) {
        console.error('MongoDB connection error:', err.message);
        isConnected = false;
        throw err;
    }
};

// Try importing middleware with error handling
let rateLimiter, multerErrorHandler, uploadRoutes;

try {
    const rateLimiterModule = await import('../Middlewares/rateLimiter.js');
    rateLimiter = rateLimiterModule.rateLimiter;
    console.log('✓ rateLimiter imported');
} catch (err) {
    console.error('✗ Failed to import rateLimiter:', err.message);
    rateLimiter = (req, res, next) => next(); // Bypass if import fails
}

try {
    const multerModule = await import('../Middlewares/MulterErrorHandler.js');
    multerErrorHandler = multerModule.multerErrorHandler;
    console.log('✓ multerErrorHandler imported');
} catch (err) {
    console.error('✗ Failed to import multerErrorHandler:', err.message);
    multerErrorHandler = (req, res, next) => next();
}

try {
    const routesModule = await import('../Routes/UploadRoutes.js');
    uploadRoutes = routesModule.default;
    console.log('✓ uploadRoutes imported');
} catch (err) {
    console.error('✗ Failed to import uploadRoutes:', err.message);
}

// Apply middleware
app.use(rateLimiter);
app.use(multerErrorHandler);

// DB connection middleware
app.use(async (req, res, next) => {
    // Skip DB for health check
    if (req.path === '/api/health' || req.path === '/') {
        return next();
    }

    try {
        await connectDB();
        next();
    } catch (err) {
        res.status(500).json({
            error: 'Database connection failed',
            message: err.message
        });
    }
});

// Routes
if (uploadRoutes) {
    app.use('/api/v1/upload', uploadRoutes);
}

// Health check
app.get('/', (req, res) => res.json({
    status: 'healthy',
    message: 'Image Compression API running',
    version: '1.0.0',
    environment: 'serverless',
    importsSuccess: {
        rateLimiter: !!rateLimiter,
        multerErrorHandler: !!multerErrorHandler,
        uploadRoutes: !!uploadRoutes
    }
}));

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        status: err.status || 500,
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.path
    });
});

export default app;