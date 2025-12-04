import express, { type IRouter } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  generateTransactionInvoice,
  sendInvoiceEmail,
  saveDraft,
  getDrafts,
  deleteDraft
} from '../controllers/transactions.controller.js';

const router: IRouter = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET /api/transactions - Get all transactions
router.get('/', getTransactions);

// Draft-related routes (must come before /:id to avoid conflicts)
// GET /api/transactions/drafts - Get user's drafts
router.get('/drafts', getDrafts);

// POST /api/transactions/drafts/autosave - Save transaction as draft
router.post('/drafts/autosave', saveDraft);

// DELETE /api/transactions/drafts/:draftId - Delete a specific draft
router.delete('/drafts/:draftId', deleteDraft);

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