import express, { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { 
  getUnits,
  getUnitById,
  createUnit,
  updateUnit,
  deleteUnit
} from '../controllers/units.controller.js';
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
} from '../controllers/categories.controller.js';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  addStock,
  getProductTemplates,
  bulkDeleteProducts
} from '../controllers/products.controller.js';
import {
  getRestockSuggestions,
  restockProduct,
  bulkRestockProducts,
  getRestockHistory,
  getRestockBatches
} from '../controllers/restock.controller.js';

const router: Router = express.Router();

// Units routes - public access for viewing units
router.get('/units', getUnits); // Public access for viewing units
router.get('/units/:id', getUnitById); // Public access for viewing units
router.post('/units', authenticateToken, createUnit);
router.put('/units/:id', authenticateToken, updateUnit);
router.delete('/units/:id', authenticateToken, deleteUnit);

// Categories routes - public access for viewing categories
router.get('/categories', getCategories); // Public access for viewing categories
router.get('/categories/:id', getCategoryById); // Public access for viewing categories
router.post('/categories', authenticateToken, createCategory);
router.put('/categories/:id', authenticateToken, updateCategory);
router.delete('/categories/:id', authenticateToken, deleteCategory);

// Products routes - require authentication for medical inventory security
router.get('/products', getProducts); // Public access for viewing products
router.get('/products/:id', authenticateToken, getProductById);
router.post('/products', authenticateToken, createProduct);
router.put('/products/:id', authenticateToken, updateProduct);
router.delete('/products/:id', authenticateToken, deleteProduct);
router.post('/products/bulk-delete', authenticateToken, bulkDeleteProducts);
router.post('/products/add-stock', authenticateToken, addStock);
router.get('/products/templates', authenticateToken, getProductTemplates);

// Restock routes - require authentication for inventory management security
router.get('/restock/suggestions', authenticateToken, getRestockSuggestions);
router.post('/restock', authenticateToken, restockProduct);
router.get('/restock', authenticateToken, getRestockHistory);
router.post('/restock/bulk', authenticateToken, bulkRestockProducts);
router.get('/restock/batches', authenticateToken, getRestockBatches);

export default router;