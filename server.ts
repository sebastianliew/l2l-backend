// Load environment variables BEFORE any other imports
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ES modules compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from backend directory FIRST
dotenv.config({ path: join(__dirname, '.env.local') });

import express, { Express, Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';

// Import routes AFTER loading environment variables
import authRoutes from './routes/auth.routes';
import brandsRoutes from './routes/brands.routes';
import containerTypesRoutes from './routes/container-types.routes';
import refundsRoutes from './routes/refunds.routes';
import transactionsRoutes from './routes/transactions.routes';
import blendTemplatesRoutes from './routes/blend-templates.routes';
import inventoryRoutes from './routes/inventory.routes';
import suppliersRoutes from './routes/suppliers.routes';
import bundlesRoutes from './routes/bundles.routes';
import appointmentsRoutes from './routes/appointments.routes';
import patientsRoutes from './routes/patients.routes';
import reportsRoutes from './routes/reports.routes';
import dashboardRoutes from './routes/dashboard.routes';

// Debug environment variables
console.log('JWT_SECRET loaded:', process.env.JWT_SECRET ? 'Yes' : 'No');
console.log('MONGODB_URI loaded:', process.env.MONGODB_URI ? 'Yes' : 'No');
console.log('Environment file path:', join(__dirname, '.env.local'));

// Type for environment variables
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      BACKEND_PORT?: string;
      MONGODB_URI?: string;
      FRONTEND_URL?: string;
      readonly NODE_ENV: 'development' | 'production' | 'test';
      JWT_SECRET?: string;
      REFRESH_TOKEN_SECRET?: string;
    }
  }
}

const app: Express = express();
const PORT: number = parseInt(process.env.BACKEND_PORT || '5001', 10);

// Database connection
const mongoUri: string = process.env.MONGODB_URI || 'mongodb://localhost:27017/l2l-backend';

// MongoDB connection options
const mongoOptions = {
  serverSelectionTimeoutMS: 30000, // 30 seconds
  socketTimeoutMS: 45000, // 45 seconds
  maxPoolSize: 10,
  minPoolSize: 5,
  maxIdleTimeMS: 30000,
};

mongoose.connect(mongoUri, mongoOptions)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch((err: Error) => console.error('❌ MongoDB connection error:', err));

// Middleware
app.use(helmet()); // Security headers
app.use(compression()); // Compress responses

// CORS configuration
interface CorsCallback {
  (err: Error | null, allow?: boolean): void;
}

const corsOptions: cors.CorsOptions = {
  origin: function (origin: string | undefined, callback: CorsCallback) {
    const allowedOrigins: string[] = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      process.env.FRONTEND_URL,
    ].filter((origin): origin is string => Boolean(origin));
    
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  optionsSuccessStatus: 200,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Authorization'],
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting - increased for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs (increased for dev)
  message: 'Too many requests from this IP, please try again later.',
});

app.use('/api/', limiter);

// Health check endpoint
app.get('/health', (_req: Request, res: Response): void => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'L2L Backend API',
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/brands', brandsRoutes);
app.use('/api/container-types', containerTypesRoutes);
app.use('/api/refunds', refundsRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/blend-templates', blendTemplatesRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/bundles', bundlesRoutes);
app.use('/api', appointmentsRoutes);
app.use('/api/patients', patientsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/dashboard', dashboardRoutes);

// 404 handler
app.use((_req: Request, res: Response): void => {
  res.status(404).json({ error: 'Not found' });
});

// Custom error interface
interface CustomError extends Error {
  status?: number;
  errors?: any;
}

// Global error handler
const errorHandler: ErrorRequestHandler = (
  err: CustomError, 
  _req: Request, 
  res: Response, 
  _next: NextFunction
): void => {
  console.error(err.stack);
  
  // Handle specific errors
  if (err.name === 'ValidationError') {
    res.status(400).json({ 
      error: 'Validation Error', 
      details: err.errors 
    });
    return;
  }
  
  if (err.name === 'UnauthorizedError') {
    res.status(401).json({ 
      error: 'Unauthorized' 
    });
    return;
  }
  
  // Default error
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server is running on http://localhost:${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;