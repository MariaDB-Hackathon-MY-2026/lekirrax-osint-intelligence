import rateLimit from 'express-rate-limit';

export const scanLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Increased limit for dev/testing
    message: {
        status: 'error',
        message: 'Too many scan requests from this IP, please try again after 15 minutes'
    },
    standardHeaders: true, 
    legacyHeaders: false, 
});

export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
});
