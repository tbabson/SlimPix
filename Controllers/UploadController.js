import { nanoid } from 'nanoid';
import sharp from 'sharp';
import archiver from 'archiver';
import Batch from '../Models/Batch.js';
import { uploadBuffer, openDownloadStreamById } from '../Services/GridfsService.js';


export const handleUpload = async (req, res) => {
    try {
        const files = req.files || [];
        if (!files.length) return res.status(400).json({ error: 'No files uploaded' });

        // Get compression quality from request or use default
        const compressionLevel = req.body.quality || 'medium';

        // Define quality settings for each level
        const qualitySettings = {
            low: { quality: 40, effort: 1 },      // Fastest compression, lowest quality
            medium: { quality: 60, effort: 3 },    // Balanced compression and speed
            high: { quality: 80, effort: 5 },      // Higher quality, more compression effort
            maximum: { quality: 95, effort: 6 }    // Best quality, maximum compression effort
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

            // Get the desired output format from request or use original format
            const outputFormat = req.body.format || f.originalname.split('.').pop().toLowerCase();
            const mimeType = f.mimetype;

            // Initialize sharp with the input buffer
            let sharpInstance = sharp(f.buffer);

            // Apply format-specific compression
            switch (outputFormat) {
                case 'webp':
                    sharpInstance = sharpInstance.webp({
                        quality: settings.quality,
                        effort: settings.effort
                    });
                    break;
                case 'jpeg':
                case 'jpg':
                    sharpInstance = sharpInstance.jpeg({
                        quality: settings.quality,
                        mozjpeg: true // Use mozjpeg for better compression
                    });
                    break;
                case 'png':
                    sharpInstance = sharpInstance.png({
                        quality: settings.quality,
                        compressionLevel: Math.floor(settings.effort * 1.5) // PNG uses 0-9 compression level
                    });
                    break;
                default:
                    // Keep original format but still optimize
                    if (mimeType.startsWith('image/')) {
                        const format = mimeType.split('/')[1];
                        if (format !== 'gif') { // Don't compress GIFs as they're already optimized
                            sharpInstance = sharpInstance[format]({
                                quality: settings.quality
                            });
                        }
                    }
            }

            const compressed = await sharpInstance.toBuffer();
            const extension = outputFormat === 'jpeg' ? 'jpg' : outputFormat;
            const storedName = `${batchId}_${nanoid(6)}_${f.originalname.replace(/\s+/g, '_')}`;
            const finalName = outputFormat === f.originalname.split('.').pop().toLowerCase()
                ? storedName
                : `${storedName}.${extension}`;

            const gridFsId = await uploadBuffer(finalName, compressed, mimeType);

            fileEntries.push({
                filename: f.originalname,
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

        // create zip from GridFS streams
        const archive = archiver('zip', { zlib: { level: 6 } });
        const zipChunks = [];
        archive.on('data', c => zipChunks.push(c));

        for (const fe of fileEntries) {
            const stream = openDownloadStreamById(fe.gridFsId);
            archive.append(stream, { name: fe.filename.replace(/\s+/g, '_') });
        }

        await archive.finalize();
        // small wait to ensure data events emitted
        await new Promise(r => setTimeout(r, 200));

        const zipBuffer = Buffer.concat(zipChunks);
        const zipName = `${batchId}.zip`;
        const zipFileId = await uploadBuffer(zipName, zipBuffer, 'application/zip');

        const batchDoc = await Batch.create({
            _id: batchId,
            originalCount: files.length,
            compressedCount: fileEntries.length,
            compressedSize: totalCompressed,
            files: fileEntries,
            zipFileId,
            expiresAt,
            compressionQuality: compressionLevel
        });

        return res.json({ batchId: batchDoc._id, downloadUrl: `/download/${batchDoc._id}`, expiresAt: batchDoc.expiresAt });
    } catch (err) {
        console.error('upload error', err);
        return res.status(500).json({ error: 'Upload processing failed', details: err.message });
    }
};

export const handleDownload = async (req, res) => {
    try {
        const { batchId } = req.params;
        const batch = await Batch.findById(batchId).lean();
        if (!batch || !batch.zipFileId) return res.status(404).json({ error: 'Batch not found' });

        if (new Date() > new Date(batch.expiresAt)) return res.status(410).json({ error: 'Expired' });

        const stream = openDownloadStreamById(batch.zipFileId);

        // Set appropriate headers for file download
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${batchId}.zip"`);
        res.setHeader('Cache-Control', 'no-cache');

        // Handle stream events properly
        stream.on('error', (error) => {
            console.error('Stream error:', error);
            if (!res.headersSent) {
                res.status(404).json({ error: 'File not found' });
            } else {
                res.end();
            }
        });

        // Pipe the stream with error handling
        stream.pipe(res).on('error', (error) => {
            console.error('Pipe error:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Download failed' });
            } else {
                res.end();
            }
        }).on('finish', () => {
            res.end();
        });
    } catch (err) {
        console.error('download error', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to stream zip' });
        } else {
            res.end();
        }
    }
};
