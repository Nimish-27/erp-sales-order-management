import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { authorize } from '../../middlewares/auth.js';
import * as ctrl from './auth.controller.js';
import { loginSchema, validate } from './auth.validator.js';

const router = Router();

router.post('/login', validate(loginSchema), ctrl.login);
router.get('/me',    authenticate,         ctrl.me);   // any authenticated user

export default router;