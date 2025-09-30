import mongoose from 'mongoose';


const BatchSchema = new mongoose.Schema({
    _id: { type: String },
    createdAt: { type: Date, default: () => new Date() },
    originalCount: Number,
    compressedCount: Number,
    compressedSize: Number,
    compressionQuality: {
        type: String,
        enum: ['low', 'medium', 'high', 'maximum'],
        default: 'medium'
    },
    files: [
        {
            filename: String,
            gridFsId: mongoose.Schema.Types.ObjectId,
            originalSize: Number,
            compressedSize: Number,
            quality: {
                level: {
                    type: String,
                    enum: ['low', 'medium', 'high', 'maximum']
                },
                settings: {
                    quality: Number,  // WebP quality setting
                    effort: Number,   // WebP encoding effort (0-6)
                }
            }
        }
    ],
    zipFileId: mongoose.Schema.Types.ObjectId,
    expiresAt: Date
});


// TTL index: expire documents 18000 seconds (5 hours) after createdAt
BatchSchema.index({ createdAt: 1 }, { expireAfterSeconds: parseInt(process.env.ZIP_EXPIRE_SECONDS || '18000', 10) });


export default mongoose.model('Batch', BatchSchema);