import express from 'express';
import { PatientsController } from '../controllers/patients.controller';

const router = express.Router();
const patientsController = new PatientsController();

// GET /api/patients - Get all patients with search and pagination
router.get('/', patientsController.getAllPatients.bind(patientsController));

// GET /api/patients/recent - Get recent patients
router.get('/recent', patientsController.getRecentPatients.bind(patientsController));

// POST /api/patients/bulk-delete - Bulk delete patients
router.post('/bulk-delete', patientsController.bulkDeletePatients.bind(patientsController));

// GET /api/patients/:id - Get patient by ID
router.get('/:id', patientsController.getPatientById.bind(patientsController));

// POST /api/patients - Create new patient
router.post('/', patientsController.createPatient.bind(patientsController));

// PUT /api/patients/:id - Update patient
router.put('/:id', patientsController.updatePatient.bind(patientsController));

// DELETE /api/patients/:id - Delete patient
router.delete('/:id', patientsController.deletePatient.bind(patientsController));

export default router;