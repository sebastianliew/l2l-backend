import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { User, IUser } from '../models/User.js';

// Extend Express Request interface to include user
export interface AuthenticatedRequest extends Request {
  user?: IUser;
}

// JWT payload interface
interface JWTPayload {
  userId: string;
  sub?: string; // JWT standard field
  role?: string;
  iat?: number;
  exp?: number;
}

export const authenticateToken = async (
  req: AuthenticatedRequest, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    console.log('Auth middleware - Authorization header:', authHeader);
    console.log('Auth middleware - Token extracted:', token ? 'Yes' : 'No');
    
    if (!token) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }
    
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || 'your-secret-key'
    ) as JWTPayload;
    
    console.log('Auth middleware - Decoded token:', decoded);
    
    // Support both userId and sub fields (JWT standard)
    const userIdToLookup = decoded.userId || decoded.sub;
    
    if (!userIdToLookup) {
      console.log('Auth middleware - No userId or sub field in token');
      res.status(401).json({ error: 'Invalid token payload' });
      return;
    }
    
    console.log('Auth middleware - Looking up user:', userIdToLookup);
    
    // Get user from database
    const user = await User.findById(userIdToLookup).select('-password');
    
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    
    // Attach user to request
    req.user = user;
    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

export const requireRole = (roles: string | string[]) => {
  return (
    req: AuthenticatedRequest, 
    res: Response, 
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    
    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    
    next();
  };
};