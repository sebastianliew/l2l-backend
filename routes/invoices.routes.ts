import express from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { downloadInvoice } from '../controllers/invoices.controller.js';

const router = express.Router();

// Apply authentication middleware
router.use(authenticateToken);

// GET /api/invoices/:filename - Download invoice PDF
router.get('/:filename', downloadInvoice);

export default router;
