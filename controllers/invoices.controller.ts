import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

// GET /api/invoices/:filename - Download invoice PDF
export const downloadInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;

    // Validate filename (security: prevent path traversal)
    if (!filename || !filename.endsWith('.pdf') || filename.includes('..') || filename.includes('/')) {
      res.status(400).json({ error: 'Invalid filename' });
      return;
    }

    const filePath = path.join(process.cwd(), 'invoices', filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    console.log('[Invoice Download] Serving file:', filename);

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      console.error('[Invoice Download] Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to download invoice' });
      }
    });
  } catch (error) {
    console.error('[Invoice Download] Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to download invoice' });
    }
  }
};
