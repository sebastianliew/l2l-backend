import express, { Router } from 'express';
import { 
  login,
  logout,
  refreshToken,
  createAdmin,
  createTempUser,
  resetPassword,
  confirmPasswordReset,
  forceLogout,
  switchUser,
  debug
} from '../controllers/auth.controller.js';
import { authenticateToken, requireRole } from '../middlewares/auth.middleware.js';

const router: Router = express.Router();

// Public routes
router.post('/login', login);
router.post('/logout', logout);
router.post('/refresh', refreshToken);
router.post('/password-reset', resetPassword);
router.post('/password-reset/confirm', confirmPasswordReset);

// Protected routes
router.get('/me', authenticateToken, (req: any, res) => {
  // Return the authenticated user
  res.json({ user: req.user });
});
router.post('/create-admin', createAdmin); // Consider adding initial setup check
router.post('/create-temp-user', authenticateToken, requireRole('admin'), createTempUser);
router.post('/force-logout', authenticateToken, forceLogout);
router.post('/switch-user', authenticateToken, requireRole(['admin', 'super_admin']), switchUser);

// Debug route (development only)
router.get('/debug', authenticateToken, debug);

export default router;