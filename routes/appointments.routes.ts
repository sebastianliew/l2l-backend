import express, { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import {
  getAppointments,
  updateAppointmentStatus,
  deleteAppointment,
  bulkDeleteAppointments
} from '../controllers/appointments.controller.js';

const router: Router = express.Router();

// Dashboard appointments routes
router.get('/dashboard/appointments', authenticateToken, getAppointments);
router.put('/dashboard/appointments/:id', authenticateToken, updateAppointmentStatus);
router.delete('/dashboard/appointments/:id', authenticateToken, deleteAppointment);

// Bulk operations
router.post('/appointments/bulk-delete', authenticateToken, bulkDeleteAppointments);

export default router;