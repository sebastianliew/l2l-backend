import { Router } from 'express';
import {
  getAllUsers,
  createUser,
  getUserById,
  updateUser,
  updateUserRole,
  updateUserPassword,
  deleteUser,
} from '@backend/controllers/users.controller.js';
import { authenticateToken, requireRole } from '@backend/middlewares/auth.middleware.js';

const router = Router();

router.use(authenticateToken);

router.get('/', requireRole(['super_admin', 'admin', 'manager']), getAllUsers);

router.post('/', requireRole(['super_admin', 'admin']), createUser);

router.get('/:id', requireRole(['super_admin', 'admin', 'manager', 'staff']), getUserById);

router.put('/:id', requireRole(['super_admin', 'admin']), updateUser);

router.patch('/:id/role', requireRole(['super_admin', 'admin']), updateUserRole);

router.patch('/:id/password', authenticateToken, updateUserPassword);

router.delete('/:id', requireRole(['super_admin', 'admin']), deleteUser);

export default router;