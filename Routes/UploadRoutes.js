import express from 'express';
import multer from 'multer';
import { handleUpload, handleDownload } from '../Controllers/UploadController.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: parseInt(process.env.UPLOAD_MAX_SIZE || '5242880', 10), files: parseInt(process.env.UPLOAD_MAX_FILES || '10', 10) } });

router.post('/', upload.array('files'), handleUpload);
router.get('/download/:batchId', handleDownload);

export default router;
