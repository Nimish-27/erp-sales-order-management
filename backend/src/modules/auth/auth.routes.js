import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, authorize } from '../../middlewares/auth.js';
import * as ctrl from './auth.controller.js';
import { loginSchema, registerSchema, validate } from './auth.validator.js';

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 10,                   // 10 attempts per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts. Please try again later.', code: 'RATE_LIMITED' },
});

const router = Router();

router.post('/login',    loginLimiter, validate(loginSchema),    ctrl.login);
router.post('/logout',   ctrl.logout);
router.get('/me',        authenticate,             ctrl.me);
// Only an authenticated ADMIN can create new users
router.post('/register', authenticate, authorize('ADMIN'), validate(registerSchema), ctrl.register);

export default router;