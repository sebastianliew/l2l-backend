import express, { Router } from 'express';
import { ItemSalesController } from '../controllers/reports/itemSalesController';
import { ReportsController } from '../controllers/reports.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router: Router = express.Router();

// Apply authentication middleware to all report routes
router.use(authenticateToken);

// Item Sales Report endpoint
router.get('/item-sales', ItemSalesController.getItemSalesReport);

// Revenue Analysis endpoint
router.get('/revenue-analysis', ReportsController.getRevenueAnalysis);

// TODO: Add other report endpoints here
// router.get('/inventory-analysis', InventoryAnalysisController.getInventoryReport);
// router.get('/sales-trends', SalesTrendsController.getSalesTrends);
// router.get('/customer-insights', CustomerInsightsController.getCustomerInsights);

export default router;