import express, { Router } from 'express';
import { ItemSalesController } from '../controllers/reports/itemSalesController';
import { ReportsController } from '../controllers/reports.controller';
import { SalesTrendsController } from '../controllers/reports/salesTrendsController';
import { InventoryAnalysisController } from '../controllers/reports/inventoryAnalysisController';
import { authenticateToken } from '../middlewares/auth.middleware';

const router: Router = express.Router();

// Apply authentication middleware to all report routes
router.use(authenticateToken);

// Item Sales Report endpoint
router.get('/item-sales', ItemSalesController.getItemSalesReport);

// Revenue Analysis endpoint
router.get('/revenue-analysis', ReportsController.getRevenueAnalysis);

// Sales Trends endpoint
router.get('/sales-trends', SalesTrendsController.getSalesTrends);

// Inventory Analysis endpoint
router.get('/inventory-analysis', InventoryAnalysisController.getInventoryAnalysis);

// TODO: Add other report endpoints here
// router.get('/customer-insights', CustomerInsightsController.getCustomerInsights);

export default router;