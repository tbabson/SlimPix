import multer from "multer";

/**
 * Express error handler that catches Multer errors and returns
 * friendly responses. Mount this after your routes (and before any
 * generic error handler) so multer errors are handled here.
 */
export const multerErrorHandler = (err, req, res, next) => {
    // If it's a Multer error, handle it here
    if (err instanceof multer.MulterError) {
        // Common Multer error codes: LIMIT_FILE_SIZE, LIMIT_FILE_COUNT, LIMIT_UNEXPECTED_FILE
        switch (err.code) {
            case "LIMIT_FILE_SIZE":
                // 413 Payload Too Large
                return res.status(413).json({
                    error: "File too large",
                    message: err.message
                });

            case "LIMIT_FILE_COUNT":
            case "LIMIT_UNEXPECTED_FILE":
                // 400 Bad Request
                return res.status(400).json({
                    error: "Too many files or unexpected file field",
                    message: err.message
                });

            default:
                // Generic multer error
                return res.status(400).json({
                    error: "Upload error",
                    code: err.code,
                    message: err.message
                });
        }
    }

    // Not a multer error — forward to next error handler
    return next(err);
};
