# SlimPix - Image Compression API

SlimPix is a powerful image compression API that converts images to WebP format with customizable compression levels. It provides batch processing capabilities and returns a convenient ZIP file containing all compressed images.

## Features

- **Multiple Compression Levels**: Choose from four quality presets:

  - Low (40% quality) - Maximum compression, smallest file size
  - Medium (60% quality) - Balanced compression and quality
  - High (80% quality) - Better visual quality
  - Maximum (95% quality) - Near-lossless quality

- **Batch Processing**: Upload multiple images at once
- **Flexible Format Support**: Maintains original image format or converts to specified format (JPEG, PNG, WebP)
- **Smart Compression**: Format-specific optimization for each image type
- **ZIP Archive**: Receives compressed images in a single ZIP file
- **Auto-Cleanup**: Automatically removes processed files after 5 hours (configurable)
- **GridFS Storage**: Efficiently handles large files using MongoDB GridFS

## Setup

1. Clone the repository:

```bash
git clone https://github.com/your-username/your-repo-name.git  # Replace with your actual repository URL
cd SlimPix
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables (create a .env file):

```env
PORT=3000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/<dbname>?retryWrites=true&w=majority  # See: https://www.mongodb.com/docs/manual/reference/connection-string/
ZIP_EXPIRE_SECONDS=18000  # 5 hours
UPLOAD_MAX_SIZE=5242880   # 5MB
UPLOAD_MAX_FILES=10
```

4. Start the server:

```bash
npm start
```

## API Endpoints

### Upload Images

- **URL**: `/upload`
- **Method**: `POST`
- **Content-Type**: `multipart/form-data`
- **Parameters**:
  - `files`: Array of image files (required)
  - `quality`: Compression quality level (optional)
    - Values: 'low', 'medium', 'high', 'maximum'
    - Default: 'medium'
  - `format`: Output format (optional)
    - Values: 'webp', 'jpeg', 'png', or omit to keep original format
    - Default: keeps original format

#### Example Request:

```javascript
const formData = new FormData();
files.forEach((file) => formData.append("files", file));
formData.append("quality", "high");

fetch("/upload", {
  method: "POST",
  body: formData,
});
```

#### Success Response:

```json
{
  "batchId": "batch_xY1zA2bC3d",
  "downloadUrl": "/download/batch_xY1zA2bC3d",
  "expiresAt": "2025-09-30T12:00:00.000Z"
}
```

### Download Compressed Images

- **URL**: `/download/:batchId`
- **Method**: `GET`
- **Response**: ZIP file containing compressed images

## Compression Settings

| Quality Level | WebP Quality | Processing Effort | Use Case               |
| ------------- | ------------ | ----------------- | ---------------------- |
| Low           | 40%          | 1 (Fastest)       | Thumbnails, previews   |
| Medium        | 60%          | 3 (Balanced)      | General web images     |
| High          | 80%          | 5 (High)          | Important visuals      |
| Maximum       | 95%          | 6 (Maximum)       | Critical quality needs |

## Technical Details

- **Image Processing**: Uses Sharp.js for efficient WebP conversion
- **File Storage**: MongoDB GridFS for scalable file storage
- **Archiving**: Uses Archiver for ZIP file creation
- **ID Generation**: Nano ID for unique batch identification
- **Error Handling**: Comprehensive error handling and status codes

## Limitations

- Maximum file size: 5MB per file (configurable)
- Maximum files per batch: 10 (configurable)
- File expiry: 5 hours after upload (configurable)
- Supported input/output formats: JPEG, PNG, WebP, TIFF, and any format supported by Sharp.js
- Format conversion: Optional, maintains original format by default

## Error Responses

- `400 Bad Request`: No files uploaded or invalid quality level
- `404 Not Found`: Batch not found
- `410 Gone`: Batch has expired
- `500 Internal Server Error`: Processing failed

## License

[MIT License](LICENSE)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

For support, please open an issue in the GitHub repository.
