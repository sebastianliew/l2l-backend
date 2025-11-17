import express from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction
} from '../controllers/transactions.controller.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET /api/transactions - Get all transactions
router.get('/', getTransactions);

// GET /api/transactions/:id - Get transaction by ID
router.get('/:id', getTransactionById);

// POST /api/transactions - Create new transaction
router.post('/', createTransaction);

// PUT /api/transactions/:id - Update transaction
router.put('/:id', updateTransaction);

// DELETE /api/transactions/:id - Delete transaction
router.delete('/:id', deleteTransaction);

export default router;