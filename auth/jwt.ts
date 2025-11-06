/**
 * JWT Authentication for Node.js Backend
 * Compatible with the frontend JWT implementation
 */
import jwt from 'jsonwebtoken';
import { IUser } from '../models/User';

// Load environment variables dynamically
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET environment variable is not set!');
    console.error('Current env vars:', Object.keys(process.env).filter(k => k.includes('JWT')));
  }
  return secret || '';
}

function getRefreshTokenSecret(): string {
  return process.env.REFRESH_TOKEN_SECRET || '';
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '4h';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

// Token payload interfaces
interface AccessTokenPayload {
  sub: string;
  userId: string;
  email: string;
  role: string;
  username: string;
  type: 'access';
  [key: string]: any; // For additional data
}

interface RefreshTokenPayload {
  sub: string;
  userId: string;
  type: 'refresh';
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface DecodedToken {
  exp?: number;
  iat?: number;
  [key: string]: any;
}

export function generateAccessToken(
  user: IUser, 
  additionalData: Record<string, any> = {}
): string {
  const JWT_SECRET = getJWTSecret();
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  
  const payload: AccessTokenPayload = {
    sub: user._id.toString(),
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    username: user.username || user.email,
    type: 'access',
    ...additionalData
  };
  
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

export function generateRefreshToken(user: IUser): string {
  const REFRESH_TOKEN_SECRET = getRefreshTokenSecret();
  if (!REFRESH_TOKEN_SECRET) {
    throw new Error('REFRESH_TOKEN_SECRET environment variable is required');
  }
  
  const payload: RefreshTokenPayload = {
    sub: user._id.toString(),
    userId: user._id.toString(),
    type: 'refresh'
  };
  
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  const JWT_SECRET = getJWTSecret();
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  
  try {
    return jwt.verify(token, JWT_SECRET) as AccessTokenPayload;
  } catch (error) {
    return null;
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  const REFRESH_TOKEN_SECRET = getRefreshTokenSecret();
  if (!REFRESH_TOKEN_SECRET) {
    throw new Error('REFRESH_TOKEN_SECRET environment variable is required');
  }
  
  try {
    return jwt.verify(token, REFRESH_TOKEN_SECRET) as RefreshTokenPayload;
  } catch (error) {
    return null;
  }
}

export async function generateTokenPair(user: IUser): Promise<TokenPair> {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  
  return {
    accessToken,
    refreshToken
  };
}

export function decodeToken(token: string): DecodedToken | null {
  try {
    return jwt.decode(token) as DecodedToken;
  } catch (error) {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) {
    return true;
  }
  
  const now = Math.floor(Date.now() / 1000);
  return decoded.exp < now;
}