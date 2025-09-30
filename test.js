import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import uploadRoutes from './routes/uploadRoutes.js';
import { rateLimiter } from './middlewares/rateLimiter.js';
import './workers/CleanupWorker.js'; // starts periodic cleanup

dotenv.config();

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/slimpix';

// App
const app = express();
app.use(express.json());
app.use(rateLimiter);

app.use('/upload', uploadRoutes);

app.get('/', (req, res) => res.json({ ok: true }));

// Connect to MongoDB and start
async function start() {
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    app.listen(PORT, () => console.log(`SlimPix-lite listening on ${PORT}`));
}

start().catch(err => {
    console.error('Failed to start app:', err);
    process.exit(1);
});