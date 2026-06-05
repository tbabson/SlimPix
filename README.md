# Image Compression API

A server-side API for batch image compression with format conversion, GridFS storage, and ZIP archive delivery.

## Features

- Batch image upload and parallel compression
- Four quality presets: `low`, `medium`, `high`, `maximum`
- Output format support: `webp`, `jpeg`, `png`, or preserve original format
- ZIP archive generation for bulk download
- MongoDB GridFS storage for compressed assets and ZIP files
- Built-in security middleware: Helmet, XSS protection, MongoDB sanitization, and rate limiting
- Health and test endpoints for quick validation
- Vercel-compatible serverless build

## Technologies

- Node.js / Express 5
- Sharp
- MongoDB / Mongoose / GridFS
- Multer
- Archiver
- Helmet, xss-clean, express-mongo-sanitize

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url>
cd image-compression
npm install
```

### 3. Start the server

```bash
npm start
```

For automatic reload during development:

```bash
npm run dev
```

## API Endpoints

### Health check

- **URL**: `/`
- **Method**: `GET`
- **Response**: `{ status, message, version }`

### Upload images

- **URL**: `/api/v1/upload`
- **Method**: `POST`
- **Content-Type**: `multipart/form-data`
- **Form fields**:
  - `files` (required): one or more image files
  - `quality` (optional): `low`, `medium`, `high`, `maximum` — default: `medium`
  - `format` (optional): `webp`, `jpeg`, `png` — omit to preserve original format

#### Example request

```js
const formData = new FormData();
files.forEach((file) => formData.append("files", file));
formData.append("quality", "high");
formData.append("format", "webp");

fetch("http://localhost:4000/api/v1/upload", {
  method: "POST",
  body: formData,
})
  .then((res) => res.json())
  .then(console.log);
```

#### Successful response

```json
{
  "batchId": "batch_xY1zA2bC3d",
  "downloadUrl": "http://localhost:4000/api/v1/upload/download/batch_xY1zA2bC3d",
  "expiresAt": "2026-05-22T15:00:00.000Z"
}
```

### Download compressed images

- **URL**: `/api/v1/upload/download/:batchId`
- **Method**: `GET`
- **Response**: `application/zip`

### Upload route test

- **URL**: `/api/v1/upload/test`
- **Method**: `GET`
- **Response**: `{ status, message, timestamp }`

## Compression quality presets

| Level   | WebP Quality | Effort | Description                       |
| ------- | ------------ | ------ | --------------------------------- |
| low     | 40           | 1      | Maximum compression, smaller size |
| medium  | 60           | 3      | Balanced quality and size         |
| high    | 80           | 5      | Better visual quality             |
| maximum | 95           | 6      | Near-lossless output              |

## Error responses

| Status | Meaning                              |
| ------ | ------------------------------------ |
| 400    | No files uploaded or invalid quality |
| 404    | Batch or file not found              |
| 410    | Batch has expired                    |
| 500    | Upload processing or download failed |

## Environment variables

| Variable             | Default   | Description                              |
| -------------------- | --------- | ---------------------------------------- |
| `PORT`               | `4000`    | Server port                              |
| `NODE_ENV`           | —         | `development` or `production`            |
| `CORS_ORIGIN`        | `*`       | Allowed CORS origin                      |
| `MONGODB_URL`        | —         | MongoDB connection string                |
| `BASE_URL`           | —         | Base public URL for download links       |
| `ZIP_EXPIRE_SECONDS` | `18000`   | ZIP expiry in seconds (default 5 hours)  |
| `UPLOAD_MAX_SIZE`    | `5242880` | Max upload size per file in bytes (5 MB) |
| `UPLOAD_MAX_FILES`   | `10`      | Max number of files per upload           |

## Deployment (Vercel)

The `vercel-build` script installs `sharp` for Linux:

```bash
npm install --platform=linux --arch=x64 sharp
```

The cleanup worker is disabled in production; expired batch deletion does not run in serverless environments.

## License

ISC
