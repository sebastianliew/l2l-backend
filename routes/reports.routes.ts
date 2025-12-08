import express, { Router } from 'express';
import { ItemSalesController } from '../controllers/reports/itemSalesController.js';
import { ReportsController } from '../controllers/reports.controller.js';
import { SalesTrendsController } from '../controllers/reports/salesTrendsController.js';
import { CustomerValueController } from '../controllers/reports/customerValueController.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router: Router = express.Router();

// Apply authentication middleware to all report routes
router.use(authenticateToken);

// Item Sales Report endpoint
router.get('/item-sales', ItemSalesController.getItemSalesReport);

// Revenue Analysis endpoint
router.get('/revenue-analysis', ReportsController.getRevenueAnalysis);

// Sales Trends endpoint
router.get('/sales-trends', SalesTrendsController.getSalesTrends);

// Customer Value Report endpoint
router.get('/customer-value', CustomerValueController.getCustomerValueReport);

// Inventory Analysis endpoint
router.get('/inventory-analysis', ReportsController.getInventoryAnalysis);

// TODO: Add other report endpoints here
// router.get('/customer-insights', CustomerInsightsController.getCustomerInsights);

export default router;