import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Cached MongoDB connection
let cachedDb = null;

const connectDB = async () => {
    if (cachedDb && mongoose.connection.readyState === 1) {
        return cachedDb;
    }

    if (!process.env.MONGODB_URL) {
        throw new Error('MONGODB_URL is not defined');
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

// Health routes (no DB needed)
app.get('/', (req, res) => {
    res.json({
        status: 'healthy',
        message: 'Image Compression API',
        version: '1.0.0',
        routes: {
            health: 'GET /api/health',
            upload: 'POST /upload',
            download: 'GET /upload/download/:batchId'
        }
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// DB middleware for /upload routes only
app.use('/upload', async (req, res, next) => {
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

// Apply middleware
try {
    const { rateLimiter } = await import('../Middlewares/RateLimiter.js');
    app.use('/upload', rateLimiter);
} catch (err) {
    console.warn('Rate limiter not loaded:', err.message);
}

try {
    const { multerErrorHandler } = await import('../Middlewares/MulterErrorHandler.js');
    app.use(multerErrorHandler);
} catch (err) {
    console.warn('Multer error handler not loaded:', err.message);
}

// Mount routes
try {
    const uploadRoutes = (await import('../Routes/UploadRoutes.js')).default;
    app.use('/upload', uploadRoutes);
    console.log('✓ Routes loaded at /upload');
} catch (err) {
    console.error('✗ Routes failed to load:', err);

    // Fallback error route
    app.use('/upload', (req, res) => {
        res.status(500).json({
            error: 'Routes unavailable',
            message: err.message,
            hint: 'Check server logs'
        });
    });
}

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error'
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