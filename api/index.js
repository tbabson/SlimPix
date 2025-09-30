import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { rateLimiter } from '../Middlewares/rateLimiter.js';
import { multerErrorHandler } from '../Middlewares/MulterErrorHandler.js';
import uploadRoutes from '../Routes/UploadRoutes.js';

// Load environment variables (important for Vercel)
dotenv.config();

const app = express();

// Essential middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Custom middleware
app.use(rateLimiter);
app.use(multerErrorHandler);

// Cached MongoDB connection for serverless
let isConnected = false;

const connectDB = async (retries = 3) => {
    // Return early if already connected
    if (isConnected && mongoose.connection.readyState === 1) {
        console.log('Using existing MongoDB connection');
        return;
    }

    try {
        await mongoose.connect(process.env.MONGODB_URL, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            minPoolSize: 2,
        });

        isConnected = true;
        console.log('MongoDB connected successfully');
    } catch (err) {
        console.error('MongoDB connection failed:', err);
        isConnected = false;

        // Retry logic for serverless
        if (retries > 0) {
            console.log(`Retrying connection... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            return connectDB(retries - 1);
        }

        throw err;
    }
};

// Connect to DB on each request (with caching)
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        res.status(500).json({
            error: 'Database connection failed',
            message: process.env.NODE_ENV === 'production' ? undefined : err.message
        });
    }
});

// Routes
app.use('/api/v1/upload', uploadRoutes);

// Health check routes
app.get('/', (req, res) => res.json({
    status: 'healthy',
    message: 'Image Compression API running',
    version: '1.0.0',
    environment: 'serverless'
}));

app.get('/api', (req, res) => res.json({
    status: 'healthy',
    message: 'Image Compression API running',
    version: '1.0.0',
    environment: 'serverless'
}));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
        status: err.status || 500
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Route not found',
        path: req.path
    });
});

// Export the Express app for Vercel
export default app;