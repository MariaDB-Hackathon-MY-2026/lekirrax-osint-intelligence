import rateLimit from 'express-rate-limit';

const isProd = process.env.NODE_ENV === 'production';

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
    max: isProd ? 200 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        const path = req.path || '';
        if (path.startsWith('/recon/status/')) return true;
        if (path === '/dashboard/threat-map') return true;
        return false;
    },
    handler: (req, res, _next, options) => {
        const resetTime = req.rateLimit?.resetTime ? new Date(req.rateLimit.resetTime).getTime() : null;
        const retryAfterSeconds = resetTime ? Math.max(1, Math.ceil((resetTime - Date.now()) / 1000)) : 60;
        res.setHeader('Retry-After', String(retryAfterSeconds));
        res.status(options.statusCode).json({
            status: 'error',
            message: 'Too many requests',
            retryAfterSeconds
        });
    }
});
