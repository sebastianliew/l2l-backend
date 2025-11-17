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

// Test route to verify Bundle model
router.get('/test', async (req, res) => {
  try {
    const { Bundle } = await import('../models/Bundle.js');
    const count = await Bundle.countDocuments();
    res.json({ success: true, bundleCount: count, message: 'Bundle model working' });
  } catch (error: unknown) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'UnknownError'
    });
  }
});

// Public routes - no authentication required  
router.get('/', getBundles);  // Allow public access to view bundles
router.get('/categories', getBundleCategories); // Allow public access to categories
router.get('/popular', getPopularBundles); // Allow public access to popular bundles
router.get('/promoted', getPromotedBundles); // Allow public access to promoted bundles

// Protected routes - require authentication
router.get('/stats', authenticateToken, getBundleStats);
router.get('/:id', authenticateToken, getBundleById);
router.get('/:id/availability', authenticateToken, checkBundleAvailability);

// Bundle creation requires authentication and admin/super_admin role
router.post('/', authenticateToken, requireRole(['admin', 'super_admin']), createBundle);
router.post('/calculate-pricing', authenticateToken, calculateBundlePricing);
router.put('/:id', authenticateToken, requireRole(['admin', 'super_admin']), updateBundle);
router.delete('/:id', authenticateToken, requireRole(['admin', 'super_admin']), deleteBundle);

export default router;