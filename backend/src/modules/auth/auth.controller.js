import { asyncHandler } from '../../middlewares/asyncHandler.js';
import * as authService from './auth.service.js';
import { audit } from '../../shared/audit.js';

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 24 * 60 * 60 * 1000,
};

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  res.cookie('token', result.token, COOKIE_OPTS);
  audit(req, 'LOGIN', 'User', result.user.id);
  res.status(200).json({ success: true, data: { user: result.user } });
});

export const me = asyncHandler(async (req, res) => {
  const user = await authService.me(req.user.id);
  res.status(200).json({ success: true, data: user });
});

export const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  audit(req, 'USER_CREATED', 'User', result.user.id, { newValue: { email: result.user.email, role: result.user.role } });
  res.status(201).json({ success: true, data: { user: result.user } });
});

export const logout = asyncHandler(async (req, res) => {
  audit(req, 'LOGOUT', 'User', req.user?.id ?? 'unknown');
  res.clearCookie('token', COOKIE_OPTS);
  res.json({ success: true });
});