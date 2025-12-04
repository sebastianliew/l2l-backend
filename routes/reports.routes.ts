import express, { Router, Request, Response } from 'express';
import { ItemSalesController } from '../controllers/reports/itemSalesController.js';
import { ReportsController } from '../controllers/reports.controller.js';
import { SalesTrendsController } from '../controllers/reports/salesTrendsController.js';
import { CustomerValueController } from '../controllers/reports/customerValueController.js';
import { InventoryAnalysisController } from '../controllers/reports/InventoryAnalysisController.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router: Router = express.Router();

// Apply authentication middleware to all report routes
router.use(authenticateToken);

// Item Sales Report endpoint
router.get('/item-sales', async (req: Request, res: Response) => {
  try {
    await ItemSalesController.getItemSalesReport(req as unknown as Parameters<typeof ItemSalesController.getItemSalesReport>[0], res as Parameters<typeof ItemSalesController.getItemSalesReport>[1]);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Revenue Analysis endpoint
router.get('/revenue-analysis', ReportsController.getRevenueAnalysis);

// Sales Trends endpoint
router.get('/sales-trends', SalesTrendsController.getSalesTrends);

// Customer Value Report endpoint
router.get('/customer-value', async (req: Request, res: Response) => {
  try {
    await CustomerValueController.getCustomerValueReport(req as unknown as Parameters<typeof CustomerValueController.getCustomerValueReport>[0], res as Parameters<typeof CustomerValueController.getCustomerValueReport>[1]);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Inventory Analysis Report endpoint
router.get('/inventory-analysis', InventoryAnalysisController.getInventoryReport);

// TODO: Add other report endpoints here
// router.get('/customer-insights', CustomerInsightsController.getCustomerInsights);

export default router;