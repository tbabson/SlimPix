import express from 'express';
import multer from 'multer';

const router = express.Router();


// const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: parseInt(process.env.UPLOAD_MAX_SIZE || '5242880', 10), files: parseInt(process.env.UPLOAD_MAX_FILES || '10', 10) } });

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: parseInt(process.env.UPLOAD_MAX_SIZE || '5242880', 10),
        files: parseInt(process.env.UPLOAD_MAX_FILES || '10', 10)
    }
});

// router.post('/', upload.array('files'), handleUpload);
// router.get('/download/:batchId', handleDownload);

router.post('/', upload.array('files'), async (req, res) => {
    try {
        const { handleUpload } = await import('../Controllers/UploadController.js');
        return handleUpload(req, res);
    } catch (err) {
        console.error('Failed to load upload controller:', err);
        return res.status(500).json({
            error: 'Upload controller failed to load',
            message: err.message,
            stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
        });
    }
});

router.get('/download/:batchId', async (req, res) => {
    try {
        const { handleDownload } = await import('../Controllers/UploadController.js');
        return handleDownload(req, res);
    } catch (err) {
        console.error('Failed to load download controller:', err);
        return res.status(500).json({
            error: 'Download controller failed to load',
            message: err.message,
            stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
        });
    }
});

export default router;

// export default router;