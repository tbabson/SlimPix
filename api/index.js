import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();

// Basic middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Cached MongoDB connection for serverless
let cachedDb = null;

const connectDB = async () => {
    if (cachedDb && mongoose.connection.readyState === 1) {
        return cachedDb;
    }

    if (!process.env.MONGODB_URL) {
        throw new Error('MONGODB_URL environment variable is not defined');
    }

    try {
        const conn = await mongoose.connect(process.env.MONGODB_URL, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            minPoolSize: 2,
        });

        cachedDb = conn;
        console.log('MongoDB connected');
        return cachedDb;
    } catch (err) {
        console.error('MongoDB connection error:', err.message);
        throw err;
    }
};

// Health check route (no DB required)
app.get('/', (req, res) => {
    res.json({
        status: 'healthy',
        message: 'Image Compression API running',
        version: '1.0.0',
        environment: 'serverless'
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Server is working',
        env: {
            hasMongoUrl: !!process.env.MONGODB_URL,
            nodeEnv: process.env.NODE_ENV
        }
    });
});

// DB connection middleware for other routes
app.use(async (req, res, next) => {
    // Skip DB for health check
    if (req.path === '/' || req.path === '/api/health') {
        return next();
    }

    try {
        await connectDB();
        next();
    } catch (err) {
        console.error('DB connection failed:', err);
        res.status(500).json({
            error: 'Database connection failed',
            message: err.message
        });
    }
});

// Import routes dynamically with error handling
let uploadRoutes;
try {
    const routesModule = await import('../Routes/UploadRoutes.js');
    uploadRoutes = routesModule.default;

    // Apply rate limiter
    try {
        const { rateLimiter } = await import('../Middlewares/RateLimiter.js');
        app.use(rateLimiter);
    } catch (err) {
        console.warn('Rate limiter not available:', err.message);
    }

    // Apply multer error handler
    try {
        const { multerErrorHandler } = await import('../Middlewares/MulterErrorHandler.js');
        app.use(multerErrorHandler);
    } catch (err) {
        console.warn('Multer error handler not available:', err.message);
    }

    // Apply routes
    app.use('/api/v1/upload', uploadRoutes);
    console.log('Routes loaded successfully');
} catch (err) {
    console.error('Failed to load routes:', err);
    // Routes will be unavailable but server will still respond to health checks
}

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        status: err.status || 500,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.path
    });
});

// Export for Vercel serverless
export default app;