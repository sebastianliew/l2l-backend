import { Request, Response } from 'express';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import { Transaction } from '../models/Transaction.js';
import { InvoiceGenerator } from '../services/invoiceGenerator.js';
import { emailService } from '../services/EmailService.js';
import { blobStorageService } from '../services/BlobStorageService.js';

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
    interface TransactionFilter {
      $or?: Array<{
        transactionNumber?: { $regex: unknown; $options: string };
        customerName?: { $regex: unknown; $options: string };
        customerEmail?: { $regex: unknown; $options: string };
      }>;
    }

    const filter: TransactionFilter = {};
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

    // Remove empty transactionNumber to allow auto-generation
    if (!transactionData.transactionNumber || transactionData.transactionNumber.trim() === '') {
      delete transactionData.transactionNumber;
    }

    // Create transaction
    const transaction = new Transaction({
      ...transactionData,
      createdBy: req.user?.id || 'system'
    });

    const savedTransaction = await transaction.save();

    // Auto-generate invoice and send email
    let invoiceGenerated = false;
    let emailSent = false;
    let invoiceError = null;

    try {
      console.log('[Transaction] Auto-generating invoice for new transaction:', savedTransaction._id);

      // Generate invoice number
      const invoiceNumber = savedTransaction.transactionNumber;

      // Ensure invoices directory exists
      // Use process.cwd() for consistent path in both dev and production
      const invoicesDir = path.join(process.cwd(), 'invoices');
      if (!fs.existsSync(invoicesDir)) {
        fs.mkdirSync(invoicesDir, { recursive: true });
      }

      // Prepare invoice data
      const subtotal = savedTransaction.items.reduce((sum, item) => sum + ((item.unitPrice ?? 0) * (item.quantity ?? 0)), 0);
      const totalDiscounts = savedTransaction.items.reduce((sum, item) => sum + (item.discountAmount ?? 0), 0);

      const invoiceData = {
        invoiceNumber,
        transactionNumber: savedTransaction.transactionNumber,
        transactionDate: savedTransaction.transactionDate,
        customerName: savedTransaction.customerName,
        customerEmail: savedTransaction.customerEmail,
        customerPhone: savedTransaction.customerPhone,
        items: savedTransaction.items.map(item => ({
          name: item.name,
          quantity: item.quantity ?? 0,
          unitPrice: item.unitPrice ?? 0,
          totalPrice: (item.unitPrice ?? 0) * (item.quantity ?? 0) - (item.discountAmount ?? 0),
          discountAmount: item.discountAmount,
          itemType: item.itemType
        })),
        subtotal,
        discountAmount: totalDiscounts,
        additionalDiscount: savedTransaction.discountAmount ?? 0,
        totalAmount: savedTransaction.totalAmount,
        paymentMethod: savedTransaction.paymentMethod,
        paymentStatus: savedTransaction.paymentStatus,
        notes: savedTransaction.notes,
        currency: savedTransaction.currency || 'SGD',
        dueDate: savedTransaction.dueDate || undefined,
        paidDate: savedTransaction.paidDate,
        paidAmount: savedTransaction.paidAmount,
        status: savedTransaction.paymentStatus
      };

      // Generate PDF
      const invoiceFileName = `${invoiceNumber}-LeafToLife.pdf`;
      const invoiceFilePath = path.join(invoicesDir, invoiceFileName);
      const relativeInvoicePath = `invoices/${invoiceFileName}`;

      const generator = new InvoiceGenerator();
      await generator.generateInvoice(invoiceData, invoiceFilePath);

      // Upload to Azure Blob Storage (or keep local if not configured)
      await blobStorageService.uploadFile(invoiceFilePath, invoiceFileName);

      // Update transaction with invoice info
      savedTransaction.invoiceGenerated = true;
      savedTransaction.invoiceNumber = invoiceNumber;
      savedTransaction.invoicePath = relativeInvoicePath;
      await savedTransaction.save();

      invoiceGenerated = true;
      console.log('[Transaction] Invoice generated successfully');

      // Auto-send email if customer email exists and email service is configured
      if (savedTransaction.customerEmail && emailService.isEnabled()) {
        try {
          console.log('[Transaction] Sending invoice email to:', savedTransaction.customerEmail);

          emailSent = await emailService.sendInvoiceEmail(
            savedTransaction.customerEmail,
            savedTransaction.customerName,
            invoiceNumber,
            invoiceFilePath,
            savedTransaction.totalAmount,
            savedTransaction.transactionDate,
            savedTransaction.paymentStatus || 'pending'
          );

          if (emailSent) {
            savedTransaction.invoiceEmailSent = true;
            savedTransaction.invoiceEmailSentAt = new Date();
            savedTransaction.invoiceEmailRecipient = savedTransaction.customerEmail;
            await savedTransaction.save();
            console.log('[Transaction] Invoice email sent successfully');
          }
        } catch (emailError) {
          console.error('[Transaction] Failed to send invoice email:', emailError);
          // Don't fail the transaction creation if email fails
        }
      }
    } catch (error) {
      console.error('[Transaction] Error during invoice generation:', error);
      invoiceError = error instanceof Error ? error.message : 'Unknown error';
      // Don't fail the transaction creation if invoice generation fails
    }

    res.status(201).json({
      ...savedTransaction.toObject(),
      _invoiceGenerated: invoiceGenerated,
      _emailSent: emailSent,
      _invoiceError: invoiceError
    });
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

// POST /api/transactions/:id/invoice - Generate invoice for transaction
export const generateTransactionInvoice = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    console.log('[Invoice] Generating invoice for transaction:', id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid transaction ID' });
      return;
    }

    // Fetch transaction
    const transaction = await Transaction.findById(id);

    if (!transaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    // Check if invoice already exists - if so, delete it to allow regeneration
    if (transaction.invoiceGenerated && transaction.invoicePath) {
      console.log('[Invoice] Invoice already exists for transaction:', id);
      // Use process.cwd() for consistent path resolution
      const invoiceFilePath = path.join(process.cwd(), transaction.invoicePath);

      // Delete existing file if it exists to allow regeneration with updated data
      if (fs.existsSync(invoiceFilePath)) {
        console.log('[Invoice] Deleting existing invoice to regenerate:', invoiceFilePath);
        fs.unlinkSync(invoiceFilePath);
      }
    }

    // Generate invoice number using transaction number format
    const invoiceNumber = transaction.transactionNumber;

    // Ensure invoices directory exists
    // Use process.cwd() for consistent path in both dev and production
    const invoicesDir = path.join(process.cwd(), 'invoices');
    if (!fs.existsSync(invoicesDir)) {
      console.log('[Invoice] Creating invoices directory:', invoicesDir);
      fs.mkdirSync(invoicesDir, { recursive: true });
    }

    // Prepare invoice data
    const subtotal = transaction.items.reduce((sum, item) => sum + ((item.unitPrice ?? 0) * (item.quantity ?? 0)), 0);
    const totalDiscounts = transaction.items.reduce((sum, item) => sum + (item.discountAmount ?? 0), 0);

    const invoiceData = {
      invoiceNumber,
      transactionNumber: transaction.transactionNumber,
      transactionDate: transaction.transactionDate,
      customerName: transaction.customerName,
      customerEmail: transaction.customerEmail,
      customerPhone: transaction.customerPhone,
      items: transaction.items.map(item => ({
        name: item.name,
        quantity: item.quantity ?? 0,
        unitPrice: item.unitPrice ?? 0,
        totalPrice: (item.unitPrice ?? 0) * (item.quantity ?? 0) - (item.discountAmount ?? 0),
        discountAmount: item.discountAmount,
        itemType: item.itemType
      })),
      subtotal,
      discountAmount: totalDiscounts,
      additionalDiscount: transaction.discountAmount ?? 0,
      totalAmount: transaction.totalAmount,
      paymentMethod: transaction.paymentMethod,
      paymentStatus: transaction.paymentStatus,
      notes: transaction.notes,
      currency: transaction.currency || 'SGD',
      dueDate: transaction.dueDate || undefined, // undefined will show "Upon Receipt" in PDF
      paidDate: transaction.paidDate,
      paidAmount: transaction.paidAmount,
      status: transaction.paymentStatus
    };

    // Generate PDF with proper filename format: TXN-XX_XX_XXXX-XXXX-LeafToLife.pdf
    const invoiceFileName = `${invoiceNumber}-LeafToLife.pdf`;
    const invoiceFilePath = path.join(invoicesDir, invoiceFileName);
    const relativeInvoicePath = `invoices/${invoiceFileName}`;

    console.log('[Invoice] Generating PDF at:', invoiceFilePath);

    const generator = new InvoiceGenerator();
    await generator.generateInvoice(invoiceData, invoiceFilePath);

    // Upload to Azure Blob Storage (or keep local if not configured)
    await blobStorageService.uploadFile(invoiceFilePath, invoiceFileName);

    // Update transaction with invoice info
    transaction.invoiceGenerated = true;
    transaction.invoiceNumber = invoiceNumber;
    transaction.invoicePath = relativeInvoicePath;
    transaction.lastModifiedBy = req.user?.id || 'system';
    await transaction.save();

    console.log('[Invoice] Invoice generated successfully:', invoiceNumber);

    // Automatically send invoice email if customer email exists and email service is configured
    let emailSent = false;
    let emailError = null;

    if (transaction.customerEmail && emailService.isEnabled()) {
      try {
        console.log('[Invoice] Automatically sending invoice email to:', transaction.customerEmail);

        emailSent = await emailService.sendInvoiceEmail(
          transaction.customerEmail,
          transaction.customerName,
          invoiceNumber,
          invoiceFilePath,
          transaction.totalAmount,
          transaction.transactionDate,
          transaction.paymentStatus || 'pending'
        );

        if (emailSent) {
          // Update transaction with email sent info
          transaction.invoiceEmailSent = true;
          transaction.invoiceEmailSentAt = new Date();
          transaction.invoiceEmailRecipient = transaction.customerEmail;
          await transaction.save();

          console.log('[Invoice] Email sent successfully to:', transaction.customerEmail);
        }
      } catch (error) {
        console.error('[Invoice] Failed to send email automatically:', error);
        emailError = error instanceof Error ? error.message : 'Unknown error';
        // Don't fail the invoice generation if email fails
      }
    } else if (transaction.customerEmail && !emailService.isEnabled()) {
      console.warn('[Invoice] Email service not configured. Skipping automatic email send.');
    } else {
      console.warn('[Invoice] No customer email provided. Skipping automatic email send.');
    }

    res.status(200).json({
      success: true,
      message: 'Invoice generated successfully',
      invoiceNumber,
      invoicePath: relativeInvoicePath,
      downloadUrl: `/api/invoices/${invoiceFileName}`,
      emailSent,
      emailError: emailError || undefined
    });
  } catch (error) {
    console.error('[Invoice] Error generating invoice:', error);
    res.status(500).json({ error: 'Failed to generate invoice' });
  }
};

// POST /api/transactions/:id/send-invoice-email - Send or resend invoice email
export const sendInvoiceEmail = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    console.log('[Email] Sending invoice email for transaction:', id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid transaction ID' });
      return;
    }

    // Fetch transaction
    const transaction = await Transaction.findById(id);

    if (!transaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    // Check if customer email exists
    if (!transaction.customerEmail) {
      res.status(400).json({ error: 'Customer email not found in transaction' });
      return;
    }

    // Check if email service is enabled
    if (!emailService.isEnabled()) {
      res.status(503).json({
        error: 'Email service not configured',
        message: 'Please configure email settings in environment variables'
      });
      return;
    }

    // ALWAYS regenerate the invoice to keep it fresh
    console.log('[Email] Regenerating invoice before sending email');

    // Delete existing invoice if it exists
    if (transaction.invoiceGenerated && transaction.invoicePath) {
      // Use process.cwd() for consistent path resolution
      const invoiceFilePath = path.join(process.cwd(), transaction.invoicePath);
      if (fs.existsSync(invoiceFilePath)) {
        console.log('[Email] Deleting existing invoice:', invoiceFilePath);
        fs.unlinkSync(invoiceFilePath);
      }
    }

    // Generate invoice number
    const invoiceNumber = transaction.transactionNumber;

    // Ensure invoices directory exists
    // Use process.cwd() for consistent path in both dev and production
    const invoicesDir = path.join(process.cwd(), 'invoices');
    if (!fs.existsSync(invoicesDir)) {
      fs.mkdirSync(invoicesDir, { recursive: true });
    }

    // Prepare invoice data
    const subtotal = transaction.items.reduce((sum, item) => sum + ((item.unitPrice ?? 0) * (item.quantity ?? 0)), 0);
    const totalDiscounts = transaction.items.reduce((sum, item) => sum + (item.discountAmount ?? 0), 0);

    const invoiceData = {
      invoiceNumber,
      transactionNumber: transaction.transactionNumber,
      transactionDate: transaction.transactionDate,
      customerName: transaction.customerName,
      customerEmail: transaction.customerEmail,
      customerPhone: transaction.customerPhone,
      items: transaction.items.map(item => ({
        name: item.name,
        quantity: item.quantity ?? 0,
        unitPrice: item.unitPrice ?? 0,
        totalPrice: (item.unitPrice ?? 0) * (item.quantity ?? 0) - (item.discountAmount ?? 0),
        discountAmount: item.discountAmount,
        itemType: item.itemType
      })),
      subtotal,
      discountAmount: totalDiscounts,
      additionalDiscount: transaction.discountAmount ?? 0,
      totalAmount: transaction.totalAmount,
      paymentMethod: transaction.paymentMethod,
      paymentStatus: transaction.paymentStatus,
      notes: transaction.notes,
      currency: transaction.currency || 'SGD',
      dueDate: transaction.dueDate || undefined,
      paidDate: transaction.paidDate,
      paidAmount: transaction.paidAmount,
      status: transaction.paymentStatus
    };

    // Generate PDF
    const invoiceFileName = `${invoiceNumber}-LeafToLife.pdf`;
    const invoiceFilePath = path.join(invoicesDir, invoiceFileName);
    const relativeInvoicePath = `invoices/${invoiceFileName}`;

    console.log('[Email] Generating fresh PDF at:', invoiceFilePath);

    const generator = new InvoiceGenerator();
    await generator.generateInvoice(invoiceData, invoiceFilePath);

    // Upload to Azure Blob Storage (or keep local if not configured)
    await blobStorageService.uploadFile(invoiceFilePath, invoiceFileName);

    // Update transaction with invoice info
    transaction.invoiceGenerated = true;
    transaction.invoiceNumber = invoiceNumber;
    transaction.invoicePath = relativeInvoicePath;

    // Send email with invoice attachment
    console.log('[Email] Sending email to:', transaction.customerEmail);

    const emailSent = await emailService.sendInvoiceEmail(
      transaction.customerEmail,
      transaction.customerName,
      invoiceNumber,
      invoiceFilePath,
      transaction.totalAmount,
      transaction.transactionDate,
      transaction.paymentStatus || 'pending'
    );

    if (emailSent) {
      // Update transaction with email sent info
      transaction.invoiceEmailSent = true;
      transaction.invoiceEmailSentAt = new Date();
      transaction.invoiceEmailRecipient = transaction.customerEmail;
      transaction.lastModifiedBy = req.user?.id || 'system';
      await transaction.save();

      console.log('[Email] Invoice email sent successfully to:', transaction.customerEmail);

      res.status(200).json({
        success: true,
        message: 'Invoice email sent successfully',
        emailSent: true,
        recipient: transaction.customerEmail,
        sentAt: transaction.invoiceEmailSentAt
      });
    } else {
      // Email service returned false (not configured)
      res.status(503).json({
        error: 'Email service not configured',
        message: 'Email sending is disabled. Please configure email settings.'
      });
    }
  } catch (error) {
    console.error('[Email] Error sending invoice email:', error);
    res.status(500).json({
      error: 'Failed to send invoice email',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};