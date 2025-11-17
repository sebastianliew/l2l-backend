import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

interface InvoiceItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  discountAmount?: number;
}

interface InvoiceData {
  invoiceNumber: string;
  transactionNumber: string;
  transactionDate: Date;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  items: InvoiceItem[];
  subtotal: number;
  discountAmount: number;
  additionalDiscount?: number;
  totalAmount: number;
  paymentMethod?: string;
  paymentStatus?: string;
  notes?: string;
}

export class InvoiceGenerator {
  private doc: PDFKit.PDFDocument;
  private yPosition: number;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number;

  constructor() {
    this.doc = new PDFDocument({ size: 'A4', margin: 50 });
    this.yPosition = 50;
    this.pageWidth = 595.28; // A4 width in points
    this.pageHeight = 841.89; // A4 height in points
    this.margin = 50;
  }

  async generateInvoice(data: InvoiceData, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(outputPath);

      stream.on('finish', () => {
        console.log('[InvoiceGenerator] PDF created successfully:', outputPath);
        resolve();
      });

      stream.on('error', (error) => {
        console.error('[InvoiceGenerator] Error writing PDF:', error);
        reject(error);
      });

      this.doc.pipe(stream);

      // Generate invoice content
      this.addHeader(data);
      this.addCustomerInfo(data);
      this.addItemsTable(data);
      this.addTotals(data);
      this.addFooter(data);

      this.doc.end();
    });
  }

  private addHeader(data: InvoiceData): void {
    // Company name/logo section
    this.doc
      .fontSize(28)
      .font('Helvetica-Bold')
      .text('LEAF TO LIFE', this.margin, this.yPosition);

    this.yPosition += 35;

    this.doc
      .fontSize(10)
      .font('Helvetica')
      .text('Holistic Wellness & Natural Remedies', this.margin, this.yPosition);

    this.yPosition += 40;

    // Invoice title and number on the right
    const rightX = this.pageWidth - this.margin - 200;
    this.doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .text('INVOICE', rightX, 50, { align: 'right', width: 200 });

    this.doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Invoice #: ${data.invoiceNumber}`, rightX, 80, { align: 'right', width: 200 })
      .text(`Transaction #: ${data.transactionNumber}`, rightX, 95, { align: 'right', width: 200 })
      .text(`Date: ${this.formatDate(data.transactionDate)}`, rightX, 110, { align: 'right', width: 200 });

    this.yPosition = 150;
    this.addDivider();
  }

  private addCustomerInfo(data: InvoiceData): void {
    this.yPosition += 20;

    this.doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('BILL TO:', this.margin, this.yPosition);

    this.yPosition += 20;

    this.doc
      .fontSize(11)
      .font('Helvetica')
      .text(data.customerName, this.margin, this.yPosition);

    if (data.customerEmail) {
      this.yPosition += 15;
      this.doc.text(data.customerEmail, this.margin, this.yPosition);
    }

    if (data.customerPhone) {
      this.yPosition += 15;
      this.doc.text(data.customerPhone, this.margin, this.yPosition);
    }

    this.yPosition += 30;
    this.addDivider();
  }

  private addItemsTable(data: InvoiceData): void {
    this.yPosition += 20;

    // Table headers
    const col1X = this.margin;
    const col2X = this.margin + 250;
    const col3X = this.margin + 320;
    const col4X = this.margin + 390;
    const col5X = this.margin + 460;

    this.doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('ITEM', col1X, this.yPosition)
      .text('QTY', col2X, this.yPosition)
      .text('UNIT PRICE', col3X, this.yPosition)
      .text('DISCOUNT', col4X, this.yPosition)
      .text('TOTAL', col5X, this.yPosition);

    this.yPosition += 20;
    this.addDivider();
    this.yPosition += 10;

    // Table rows
    this.doc.font('Helvetica').fontSize(9);

    data.items.forEach((item) => {
      // Check if we need a new page
      if (this.yPosition > this.pageHeight - 200) {
        this.doc.addPage();
        this.yPosition = this.margin;
      }

      const itemName = item.name.length > 35 ? item.name.substring(0, 35) + '...' : item.name;

      this.doc.text(itemName, col1X, this.yPosition, { width: 240 });
      this.doc.text(item.quantity.toString(), col2X, this.yPosition);
      this.doc.text(`$${item.unitPrice.toFixed(2)}`, col3X, this.yPosition);

      if (item.discountAmount && item.discountAmount > 0) {
        this.doc.text(`-$${item.discountAmount.toFixed(2)}`, col4X, this.yPosition);
      } else {
        this.doc.text('-', col4X, this.yPosition);
      }

      this.doc.text(`$${item.totalPrice.toFixed(2)}`, col5X, this.yPosition);

      this.yPosition += 25;
    });

    this.yPosition += 10;
    this.addDivider();
  }

  private addTotals(data: InvoiceData): void {
    this.yPosition += 20;

    const labelX = this.pageWidth - this.margin - 200;
    const valueX = this.pageWidth - this.margin - 80;

    this.doc.fontSize(10).font('Helvetica');

    // Subtotal
    this.doc
      .text('Subtotal:', labelX, this.yPosition)
      .text(`$${data.subtotal.toFixed(2)}`, valueX, this.yPosition);

    this.yPosition += 20;

    // Item-level discounts
    if (data.discountAmount > 0) {
      this.doc
        .text('Member Discounts:', labelX, this.yPosition)
        .text(`-$${data.discountAmount.toFixed(2)}`, valueX, this.yPosition);
      this.yPosition += 20;
    }

    // Additional discount
    if (data.additionalDiscount && data.additionalDiscount > 0) {
      this.doc
        .text('Additional Discount:', labelX, this.yPosition)
        .text(`-$${data.additionalDiscount.toFixed(2)}`, valueX, this.yPosition);
      this.yPosition += 20;
    }

    this.yPosition += 5;
    this.doc
      .moveTo(labelX, this.yPosition)
      .lineTo(this.pageWidth - this.margin, this.yPosition)
      .stroke();
    this.yPosition += 15;

    // Total
    this.doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('TOTAL:', labelX, this.yPosition)
      .text(`$${data.totalAmount.toFixed(2)}`, valueX, this.yPosition);

    this.yPosition += 30;

    // Payment info
    if (data.paymentMethod || data.paymentStatus) {
      this.doc.fontSize(9).font('Helvetica');

      if (data.paymentMethod) {
        this.doc.text(`Payment Method: ${this.formatPaymentMethod(data.paymentMethod)}`, labelX, this.yPosition);
        this.yPosition += 15;
      }

      if (data.paymentStatus) {
        const statusText = `Payment Status: ${this.formatPaymentStatus(data.paymentStatus)}`;
        this.doc.text(statusText, labelX, this.yPosition);
        this.yPosition += 15;
      }
    }
  }

  private addFooter(data: InvoiceData): void {
    const footerY = this.pageHeight - this.margin - 60;

    if (data.notes) {
      this.doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .text('NOTES:', this.margin, footerY - 40);

      this.doc
        .font('Helvetica')
        .text(data.notes, this.margin, footerY - 25, { width: 400 });
    }

    // Footer divider
    this.doc
      .moveTo(this.margin, footerY)
      .lineTo(this.pageWidth - this.margin, footerY)
      .stroke();

    // Footer text
    this.doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#666666')
      .text(
        'Thank you for your business!',
        this.margin,
        footerY + 10,
        { align: 'center', width: this.pageWidth - 2 * this.margin }
      )
      .text(
        `Generated on ${this.formatDate(new Date())}`,
        this.margin,
        footerY + 25,
        { align: 'center', width: this.pageWidth - 2 * this.margin }
      );
  }

  private addDivider(): void {
    this.doc
      .moveTo(this.margin, this.yPosition)
      .lineTo(this.pageWidth - this.margin, this.yPosition)
      .strokeColor('#cccccc')
      .stroke();
  }

  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  private formatPaymentMethod(method: string): string {
    const methods: Record<string, string> = {
      cash: 'Cash',
      card: 'Credit/Debit Card',
      bank_transfer: 'Bank Transfer',
      e_wallet: 'E-Wallet',
      other: 'Other'
    };
    return methods[method] || method;
  }

  private formatPaymentStatus(status: string): string {
    const statuses: Record<string, string> = {
      paid: 'Paid',
      pending: 'Pending',
      partial: 'Partially Paid',
      overdue: 'Overdue',
      failed: 'Failed',
      refunded: 'Refunded'
    };
    return statuses[status] || status;
  }
}
