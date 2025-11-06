import express from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import {
  getRefunds,
  getRefundById,
  createRefund,
  approveRefund,
  rejectRefund,
  processRefund,
  completeRefund,
  cancelRefund,
  getTransactionRefunds,
  getRefundEligibility,
  getRefundStatistics
} from '../controllers/refunds.controller.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET /api/refunds - Get all refunds with optional filters
router.get('/', getRefunds);

// GET /api/refunds/statistics - Get refund statistics
router.get('/statistics', getRefundStatistics);

// GET /api/refunds/:id - Get refund by ID
router.get('/:id', getRefundById);

// POST /api/refunds - Create new refund
router.post('/', createRefund);

// PUT /api/refunds/:id/approve - Approve refund
router.put('/:id/approve', approveRefund);

// PUT /api/refunds/:id/reject - Reject refund
router.put('/:id/reject', rejectRefund);

// PUT /api/refunds/:id/process - Process refund (handle inventory)
router.put('/:id/process', processRefund);

// PUT /api/refunds/:id/complete - Complete refund (finalize payment)
router.put('/:id/complete', completeRefund);

// PUT /api/refunds/:id/cancel - Cancel refund
router.put('/:id/cancel', cancelRefund);

// GET /api/refunds/transaction/:transactionId - Get refunds for a transaction
router.get('/transaction/:transactionId', getTransactionRefunds);

// GET /api/refunds/eligibility/:transactionId - Check refund eligibility for transaction
router.get('/eligibility/:transactionId', getRefundEligibility);

export default router;