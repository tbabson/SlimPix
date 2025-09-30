import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { rateLimiter } from './Middlewares/rateLimiter.js';
import { multerErrorHandler } from './Middlewares/MulterErrorHandler.js';
import dotenv from 'dotenv';
dotenv.config();


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(rateLimiter);
app.use(multerErrorHandler);

// routes
import uploadRoutes from './Routes/UploadRoutes.js';
import './workers/CleanupWorker.js';


app.use('/api/v1/upload', uploadRoutes);



app.get('/', (req, res) => res.send('Image Compression API running'));


const PORT = process.env.PORT || 4000;


try {
    await mongoose.connect(process.env.MONGODB_URL);
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}...`);
    });
} catch (err) {
    console.error(err);
    process.exit(1);
}


