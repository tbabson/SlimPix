// services/gridfsService.js
import mongoose from 'mongoose';

let bucket;

const ensureDbReady = () => {
    if (!mongoose.connection || !mongoose.connection.db) {
        throw new Error('MongoDB connection not ready. Make sure mongoose.connect(...) finished before using GridFS.');
    }
};

const toObjectId = (id) => {
    if (!id) throw new Error('Missing id');
    // if already an ObjectId, return it
    if (id instanceof mongoose.Types.ObjectId) return id;
    // if it's a plain object with _bsontype (native ObjectId), return as-is
    if (id && typeof id === 'object' && id._bsontype === 'ObjectID') return id;
    // otherwise construct a new ObjectId (must use `new`)
    return new mongoose.Types.ObjectId(id);
};

export const initGridFS = () => {
    ensureDbReady();
    if (!bucket) {
        const db = mongoose.connection.db;
        bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'slimpix_files' });
    }
    return bucket;
};

export const uploadBuffer = async (filename, buffer, contentType = 'application/octet-stream') => {
    const b = initGridFS();
    return new Promise((resolve, reject) => {
        const uploadStream = b.openUploadStream(filename, { contentType });
        uploadStream.end(buffer, (err) => {
            if (err) return reject(err);
            resolve(uploadStream.id); // returns an ObjectId instance
        });
    });
};

export const openDownloadStreamById = (id) => {
    const b = initGridFS();
    const objectId = toObjectId(id);
    return b.openDownloadStream(objectId);
};

export const deleteFileById = async (id) => {
    if (!id) return;
    const b = initGridFS();
    try {
        const objectId = toObjectId(id);
        await b.delete(objectId);
    } catch (err) {
        // If file already deleted or invalid id, log and continue
        console.warn('deleteFileById warning (ignored):', err.message || err);
    }
};
