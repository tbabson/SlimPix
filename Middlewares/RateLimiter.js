import rateLimit from 'express-rate-limit';

// Bypass rate limiting in production serverless (or use Vercel KV)
export const rateLimiter = process.env.NODE_ENV === 'production'
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '3600000', 10),
        max: parseInt(process.env.RATE_LIMIT_MAX || '30', 10),
        message: { error: 'Too many requests from this IP, please try again later.' }
    });