import express from 'express';
import multer from 'multer';
import { handleUpload, handleDownload } from '../Controllers/UploadController.js';

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: parseInt(process.env.UPLOAD_MAX_SIZE || '5242880', 10),
        files: parseInt(process.env.UPLOAD_MAX_FILES || '10', 10)
    }
});

// Test endpoint
router.get('/test', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Upload routes working!',
        timestamp: new Date().toISOString()
    });
});

// Upload route
router.post('/', upload.array('files'), handleUpload);

// Download route
router.get('/download/:batchId', handleDownload);

export default router;