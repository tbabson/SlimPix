import rateLimit from 'express-rate-limit';


export const rateLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '3600000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '30', 10),
    message: { error: 'Too many requests from this IP, please try again later.' }
});