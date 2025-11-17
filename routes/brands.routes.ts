import express, { Router } from 'express';
import { authenticateToken, requireRole } from '../middlewares/auth.middleware.js';
import {
  getBrands,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand
} from '../controllers/brands.controller.js';

const router: Router = express.Router();

// All brand access requires authentication for business security
router.get('/', authenticateToken, getBrands);
router.get('/:id', authenticateToken, getBrandById);

// Protected routes
router.post('/', authenticateToken, requireRole(['admin', 'super_admin']), createBrand);
router.put('/:id', authenticateToken, requireRole(['admin', 'super_admin']), updateBrand);
router.delete('/:id', authenticateToken, requireRole(['admin', 'super_admin']), deleteBrand);

export default router;