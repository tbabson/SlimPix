import Batch from '../Models/Batch.js';
import { deleteFileById } from '../Services/GridfsService.js';

// Runs periodically to delete GridFS files for expired batches
async function cleanupExpired() {
    try {
        const cutoff = new Date(Date.now() - (parseInt(process.env.ZIP_EXPIRE_SECONDS || '18000', 10) * 1000));
        const expired = await Batch.find({ createdAt: { $lt: cutoff } }).lean();
        if (!expired.length) return;

        for (const b of expired) {
            try {
                if (Array.isArray(b.files)) {
                    for (const f of b.files) {
                        try { await deleteFileById(f.gridFsId); } catch (e) { }
                    }
                }
                if (b.zipFileId) {
                    try { await deleteFileById(b.zipFileId); } catch (e) { }
                }
                await Batch.deleteOne({ _id: b._id });
                console.log('cleaned batch', b._id);
            } catch (err) {
                console.error('cleanup error for batch', b._id, err);
            }
        }
    } catch (err) {
        console.error('cleanup worker error', err);
    }
}

// run every 30 minutes
setInterval(cleanupExpired, 30 * 60 * 1000);

// run once on startup
cleanupExpired().catch(err => console.error(err));