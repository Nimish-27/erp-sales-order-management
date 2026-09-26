import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { authorize } from '../../middlewares/auth.js';
import * as ctrl from './auth.controller.js';
import { loginSchema, registerSchema, validate } from './auth.validator.js';

const router = Router();

router.post('/login', validate(loginSchema), ctrl.login);
router.post('/register', validate(registerSchema), ctrl.register);
router.get('/me',    authenticate,         ctrl.me);   // any authenticated user

export default router;