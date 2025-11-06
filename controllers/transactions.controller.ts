import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Transaction } from '../models/Transaction.js';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    username: string;
  };
}

// GET /api/transactions - Get all transactions
export const getTransactions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { search, limit = '50' } = req.query;
    const limitNumber = parseInt(limit as string, 10);

    // Build filter
    const filter: any = {};
    if (search) {
      filter.$or = [
        { transactionNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerEmail: { $regex: search, $options: 'i' } }
      ];
    }

    // Get transactions
    const transactions = await Transaction.find(filter)
      .sort({ transactionDate: -1 })
      .limit(limitNumber)
      .lean();

    res.status(200).json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
};

// GET /api/transactions/:id - Get transaction by ID
export const getTransactionById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid transaction ID' });
      return;
    }

    const transaction = await Transaction.findById(id);

    if (!transaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    res.status(200).json(transaction);
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
};

// POST /api/transactions - Create transaction
export const createTransaction = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const transactionData = req.body;

    // Basic validation
    if (!transactionData.customerName || !transactionData.items || transactionData.items.length === 0) {
      res.status(400).json({ error: 'Customer name and items are required' });
      return;
    }

    // Create transaction
    const transaction = new Transaction({
      ...transactionData,
      createdBy: req.user?.id || 'system'
    });

    const savedTransaction = await transaction.save();
    res.status(201).json(savedTransaction);
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
};

// PUT /api/transactions/:id - Update transaction
export const updateTransaction = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid transaction ID' });
      return;
    }

    const updatedTransaction = await Transaction.findByIdAndUpdate(
      id,
      { ...updateData, lastModifiedBy: req.user?.id || 'system' },
      { new: true }
    );

    if (!updatedTransaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    res.status(200).json(updatedTransaction);
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
};

// DELETE /api/transactions/:id - Delete transaction
export const deleteTransaction = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid transaction ID' });
      return;
    }

    const deletedTransaction = await Transaction.findByIdAndDelete(id);

    if (!deletedTransaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    res.status(200).json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
};