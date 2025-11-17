import express, { Router } from 'express';
import { authenticateToken, requireRole } from '../middlewares/auth.middleware.js';
import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier
} from '../controllers/suppliers.controller.js';

const router: Router = express.Router();

// Protected routes - require authentication
router.get('/', authenticateToken, getSuppliers);
router.get('/:id', authenticateToken, getSupplierById);

// Protected routes
router.post('/', authenticateToken, requireRole(['admin', 'super_admin']), createSupplier);
router.put('/:id', authenticateToken, requireRole(['admin', 'super_admin']), updateSupplier);
router.delete('/:id', authenticateToken, requireRole(['admin', 'super_admin']), deleteSupplier);

export default router;