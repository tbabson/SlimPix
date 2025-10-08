// Controllers/UploadController.js
import { nanoid } from 'nanoid';

export const handleUpload = async (req, res) => {
    try {
        // Dynamic imports to reduce cold-start weight and avoid bundler/native binary issues at top-level
        const sharp = (await import('sharp')).default;
        const archiver = (await import('archiver')).default;
        const { PassThrough } = await import('stream');
        const Batch = (await import('../Models/Batch.js')).default;
        const { uploadBuffer, openDownloadStreamById } = await import('../Services/GridfsService.js');

        const files = req.files || [];
        if (!files.length) return res.status(400).json({ error: 'No files uploaded' });

        const compressionLevel = (req.body.quality || 'medium').toString().toLowerCase();

        const qualitySettings = {
            low: { quality: 40, effort: 1 },
            medium: { quality: 60, effort: 3 },
            high: { quality: 80, effort: 5 },
            maximum: { quality: 95, effort: 6 }
        };

        if (!qualitySettings[compressionLevel]) {
            return res.status(400).json({ error: 'Invalid compression quality level' });
        }

        const batchId = `batch_${nanoid(10)}`;
        const expiresAt = new Date(Date.now() + parseInt(process.env.ZIP_EXPIRE_SECONDS || '18000', 10) * 1000);

        const fileEntries = [];
        let totalCompressed = 0;

        // compress and upload each file to GridFS
        for (const f of files) {
            const settings = qualitySettings[compressionLevel];
            const originalExt = (f.originalname.split('.').pop() || '').toLowerCase();
            const requestedFormat = (req.body.format || originalExt).toLowerCase();

            let sharpInstance = sharp(f.buffer, { failOnError: false });

            // Configure encoder based on requestedFormat (fallback to original)
            let outputExt = requestedFormat;
            if (requestedFormat === 'jpg') outputExt = 'jpeg';

            switch (outputExt) {
                case 'webp':
                    sharpInstance = sharpInstance.webp({ quality: settings.quality, effort: settings.effort });
                    break;
                case 'jpeg':
                case 'jpg':
                    sharpInstance = sharpInstance.jpeg({ quality: settings.quality, mozjpeg: true });
                    outputExt = 'jpg';
                    break;
                case 'png':
                    // sharp.png doesn't accept 'quality' in same way as jpeg; we use compressionLevel instead
                    sharpInstance = sharpInstance.png({ compressionLevel: Math.min(9, Math.max(0, Math.floor(settings.effort * 2))) });
                    break;
                default:
                    // If unknown format, try to preserve original format where possible
                    if (f.mimetype && f.mimetype.startsWith('image/')) {
                        const fmt = f.mimetype.split('/')[1];
                        if (fmt && fmt !== 'gif' && typeof sharpInstance[fmt] === 'function') {
                            try {
                                sharpInstance = sharpInstance[fmt]({ quality: settings.quality });
                                outputExt = fmt === 'jpeg' ? 'jpg' : fmt;
                            } catch (e) {
                                // ignore and continue
                            }
                        }
                    }
            }

            const compressed = await sharpInstance.toBuffer();

            // Decide final file name and mime type for storage
            const extension = outputExt === 'jpeg' ? 'jpg' : outputExt;

            // Remove the original extension from the filename
            const baseNameWithoutExt = f.originalname.replace(/\.[^/.]+$/, '');
            const sanitizedBaseName = baseNameWithoutExt.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');

            // Build final filename with new extension
            const finalName = `${batchId}_${nanoid(6)}_${sanitizedBaseName}.${extension}`;

            let uploadMime = f.mimetype;
            if (extension === 'webp') uploadMime = 'image/webp';
            else if (extension === 'jpg' || extension === 'jpeg') uploadMime = 'image/jpeg';
            else if (extension === 'png') uploadMime = 'image/png';

            const gridFsId = await uploadBuffer(finalName, compressed, uploadMime);

            fileEntries.push({
                filename: `${baseNameWithoutExt}.${extension}`, // Return with new extension
                gridFsId,
                originalSize: f.size,
                compressedSize: compressed.length,
                quality: {
                    level: compressionLevel,
                    settings: qualitySettings[compressionLevel]
                }
            });

            totalCompressed += compressed.length;
        }

        // create zip from GridFS streams using a PassThrough collector
        const archive = archiver('zip', { zlib: { level: 6 } });
        const pass = new PassThrough();
        const zipChunks = [];
        pass.on('data', (c) => zipChunks.push(c));

        // error handling
        const finalizePromise = new Promise((resolve, reject) => {
            pass.on('end', resolve);
            pass.on('error', reject);
            archive.on('error', reject);
        });

        archive.pipe(pass);

        for (const fe of fileEntries) {
            const stream = openDownloadStreamById(fe.gridFsId);
            archive.append(stream, { name: fe.filename.replace(/\s+/g, '_') });
        }

        // finalize the archive and wait until the pass stream ends
        await archive.finalize();
        await finalizePromise;

        const zipBuffer = Buffer.concat(zipChunks);
        const zipName = `${batchId}.zip`;
        const zipFileId = await uploadBuffer(zipName, zipBuffer, 'application/zip');

        // create DB record
        const BatchModel = Batch; // alias for clarity
        const batchDoc = await BatchModel.create({
            _id: batchId,
            originalCount: files.length,
            compressedCount: fileEntries.length,
            compressedSize: totalCompressed,
            files: fileEntries,
            zipFileId,
            expiresAt,
            compressionQuality: compressionLevel
        });

        // Build stable download URL:
        const basePath = (req.baseUrl || '').replace(/\/$/, ''); // remove trailing slash
        const downloadPath = `${basePath}/download/${batchDoc._id}`;

        // Prefer BASE_URL env var when behind proxies/CDNs; otherwise derive from request
        const origin = process.env.BASE_URL ? process.env.BASE_URL.replace(/\/$/, '') : `${req.protocol}://${req.get('host')}`;

        const fullUrl = `${origin}${downloadPath.startsWith('/') ? downloadPath : '/' + downloadPath}`;

        // Return only the absolute download URL (no relativeDownloadUrl)
        return res.json({
            batchId: batchDoc._id,
            downloadUrl: fullUrl,
            expiresAt: batchDoc.expiresAt
        });
    } catch (err) {
        console.error('upload error', err);
        return res.status(500).json({
            error: 'Upload processing failed',
            message: err.message,
            stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
        });
    }
};

export const handleDownload = async (req, res) => {
    try {
        const Batch = (await import('../Models/Batch.js')).default;
        const { openDownloadStreamById } = await import('../Services/GridfsService.js');

        const { batchId } = req.params;
        const batch = await Batch.findById(batchId).lean();
        if (!batch || !batch.zipFileId) {
            return res.status(404).json({ error: 'Batch not found' });
        }

        if (new Date() > new Date(batch.expiresAt)) {
            return res.status(410).json({ error: 'Expired' });
        }

        const stream = openDownloadStreamById(batch.zipFileId);

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${batchId}.zip"`);
        res.setHeader('Cache-Control', 'no-cache');

        stream.on('error', (error) => {
            console.error('Stream error:', error);
            if (!res.headersSent) {
                res.status(404).json({ error: 'File not found' });
            } else {
                try { res.end(); } catch (_) { /* ignore */ }
            }
        });

        stream.pipe(res).on('error', (error) => {
            console.error('Pipe error:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Download failed' });
            } else {
                try { res.end(); } catch (_) { /* ignore */ }
            }
        });
    } catch (err) {
        console.error('download error', err);
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Failed to stream zip',
                message: err.message
            });
        } else {
            try { res.end(); } catch (_) { /* ignore */ }
        }
    }
};