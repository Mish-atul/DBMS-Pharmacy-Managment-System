/**
 * Authentication Middleware
 * 
 * Provides JWT token verification and role-based access control.
 * 
 * Usage:
 *   const { verifyToken, requireRole } = require('./middleware/auth');
 *   app.get('/api/protected', verifyToken, (req, res) => { ... });
 *   app.get('/api/admin', verifyToken, requireRole('admin'), (req, res) => { ... });
 */

const jwt = require('jsonwebtoken');

// Load JWT secret from environment
const JWT_SECRET = process.env.JWT_SECRET || 'demo_jwt_secret_change_in_production_12345';

/**
 * Middleware to verify JWT token from Authorization header
 * Attaches decoded user info to req.user = { id, role, email }
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next middleware
 */
function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;

    // Check for Bearer token
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
            error: 'Missing or invalid authorization header',
            message: 'Please provide a valid Bearer token' 
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Verify token and decode payload
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Attach user info to request object
        req.user = {
            id: decoded.userId,
            role: decoded.role || 'user',
            email: decoded.email
        };
        
        return next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                error: 'Token expired',
                message: 'Your session has expired. Please login again.' 
            });
        }
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                error: 'Invalid token',
                message: 'The provided token is invalid.' 
            });
        }
        return res.status(401).json({ 
            error: 'Authentication failed',
            message: 'Unable to verify token.' 
        });
    }
}

/**
 * Middleware factory to check user role
 * Must be used after verifyToken middleware
 * 
 * @param {string} role - Required role ('admin', 'user')
 * @returns {Function} Express middleware
 * 
 * @example
 *   app.get('/api/admin/data', verifyToken, requireRole('admin'), handler);
 */
function requireRole(role) {
    return (req, res, next) => {
        // Ensure verifyToken was called first
        if (!req.user) {
            return res.status(401).json({ 
                error: 'Not authenticated',
                message: 'Authentication required before role check.' 
            });
        }

        // Check if user has required role
        if (req.user.role !== role) {
            return res.status(403).json({ 
                error: 'Forbidden',
                message: `This action requires '${role}' role. Your role: '${req.user.role}'` 
            });
        }

        return next();
    };
}

/**
 * Optional middleware - allows both authenticated and unauthenticated requests
 * If token is present and valid, attaches user to req.user
 * If no token or invalid, continues without setting req.user
 */
function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(); // Continue without user
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = {
            id: decoded.userId,
            role: decoded.role || 'user',
            email: decoded.email
        };
    } catch (err) {
        // Token invalid, but continue anyway (optional auth)
        req.user = null;
    }

    return next();
}

module.exports = { 
    verifyToken, 
    requireRole,
    optionalAuth,
    JWT_SECRET 
};
