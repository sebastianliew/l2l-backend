import express, { type IRouter } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  generateTransactionInvoice,
  sendInvoiceEmail
} from '../controllers/transactions.controller.js';

const router: IRouter = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET /api/transactions - Get all transactions
router.get('/', getTransactions);

// GET /api/transactions/:id - Get transaction by ID
router.get('/:id', getTransactionById);

// POST /api/transactions - Create new transaction
router.post('/', createTransaction);

// POST /api/transactions/:id/invoice - Generate invoice for transaction
router.post('/:id/invoice', generateTransactionInvoice);

// POST /api/transactions/:id/send-invoice-email - Send or resend invoice email
router.post('/:id/send-invoice-email', sendInvoiceEmail);

// PUT /api/transactions/:id - Update transaction
router.put('/:id', updateTransaction);

// DELETE /api/transactions/:id - Delete transaction
router.delete('/:id', deleteTransaction);

export default router;