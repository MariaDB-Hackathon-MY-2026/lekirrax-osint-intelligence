import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { logger } from '../services/logger.js';

dotenv.config();

const rawSecret = process.env.JWT_SECRET;
const nodeEnv = process.env.NODE_ENV || 'development';

if (nodeEnv === 'production' && !rawSecret) {
    throw new Error('JWT_SECRET is required in production');
}

if (!rawSecret) {
    logger.warn('JWT_SECRET is missing; using insecure development secret');
}

const JWT_SECRET = rawSecret || 'dev-insecure-jwt-secret';

/**
 * Middleware to protect routes with JWT authentication
 */
export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const tokenFromCookie = req.cookies?.token;
    
    // Check Authorization header (Bearer token) or token cookie
    const token = (authHeader && authHeader.split(' ')[1]) || tokenFromCookie;

    if (!token) {
        return res.status(401).json({ 
            status: 'error',
            message: 'Authentication required' 
        });
    }

    try {
        const user = jwt.verify(token, JWT_SECRET);
        req.user = user;
        next();
    } catch (err) {
        logger.warn(`Invalid token attempt: ${err.message}`);
        return res.status(403).json({ 
            status: 'error',
            message: 'Invalid or expired token' 
        });
    }
};

/**
 * Helper to generate a token for a user
 */
export const generateToken = (payload) => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
};
