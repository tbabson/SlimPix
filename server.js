import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { rateLimiter } from './Middlewares/RateLimiter.js';
import { multerErrorHandler } from './Middlewares/MulterErrorHandler.js';
import dotenv from 'dotenv';
import helmet from 'helmet';
import xss from 'xss-clean';
import mongoSanitize from 'express-mongo-sanitize';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Essential middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Logging in development only
if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
}

// Security middleware
app.use(helmet());
app.use(xss());
app.use(mongoSanitize());

// Body parser middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Custom middleware
app.use(rateLimiter);
app.use(multerErrorHandler);

// Import routes
import uploadRoutes from './Routes/UploadRoutes.js';

// Disable cleanup worker in serverless environment
if (process.env.NODE_ENV !== 'production') {
    import('./workers/CleanupWorker.js');
}

// Routes
app.use('/api/v1/upload', uploadRoutes);

// Health check route
app.get('/', (req, res) => res.json({
    status: 'healthy',
    message: 'Image Compression API running',
    version: '1.0.0'
}));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
        status: err.status || 500
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

const port = process.env.PORT || 4000;


// MongoDB connection with retry logic
const connectDB = async (retries = 5) => {
    try {
        await mongoose.connect(process.env.MONGODB_URL, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            minPoolSize: 2,
            heartbeatFrequencyMS: 10000
        });
        console.log('MongoDB connected successfully');
        return true;
    } catch (err) {
        if (retries > 0) {
            console.log(`MongoDB connection failed. Retrying... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            return connectDB(retries - 1);
        }
        console.error('MongoDB connection failed after all retries:', err);
        throw err;
    }
};

// Start server function
const startServer = async () => {
    try {
        await connectDB();

        // In production (serverless), we don't need to listen
        if (process.env.NODE_ENV !== 'production') {
            app.listen(port, () => {
                console.log(`Server running on port ${port}...`);
            });
        }
    } catch (err) {
        console.error('Server startup failed:', err);
        process.exit(1);
    }
};

// Initialize server
startServer();

// Export for serverless use
export default app;


