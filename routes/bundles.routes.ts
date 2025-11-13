import express, { Router } from 'express';
import { authenticateToken, requireRole } from '../middlewares/auth.middleware.js';
import {
  getBundles,
  getBundleById,
  createBundle,
  updateBundle,
  deleteBundle,
  getBundleCategories,
  getPopularBundles,
  getPromotedBundles,
  getBundleStats,
  checkBundleAvailability,
  calculateBundlePricing
} from '../controllers/bundles.controller.js';

const router: Router = express.Router();

// Public routes - no authentication required
router.get('/', getBundles);  // Allow public access to view bundles

// Protected routes - require authentication
router.get('/categories', authenticateToken, getBundleCategories);
router.get('/popular', authenticateToken, getPopularBundles);
router.get('/promoted', authenticateToken, getPromotedBundles);
router.get('/stats', authenticateToken, getBundleStats);
router.get('/:id', authenticateToken, getBundleById);
router.get('/:id/availability', authenticateToken, checkBundleAvailability);

// Protected routes
router.post('/', authenticateToken, requireRole(['admin', 'super_admin']), createBundle);
router.post('/calculate-pricing', authenticateToken, calculateBundlePricing);
router.put('/:id', authenticateToken, requireRole(['admin', 'super_admin']), updateBundle);
router.delete('/:id', authenticateToken, requireRole(['admin', 'super_admin']), deleteBundle);

export default router;