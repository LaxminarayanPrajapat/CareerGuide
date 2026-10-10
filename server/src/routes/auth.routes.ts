import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '../schemas/user.schema.js';

const router = Router();

router.post('/register', authLimiter, validate({ body: registerSchema }), auth.register);
router.post('/login', authLimiter, validate({ body: loginSchema }), auth.login);
router.post('/logout', auth.logout);
router.get('/me', authenticate, auth.me);

router.patch('/profile', authenticate, validate({ body: updateProfileSchema }), auth.updateMyProfile);
router.post('/change-password', authenticate, authLimiter, validate({ body: changePasswordSchema }), auth.changeMyPassword);

router.post('/forgot-password', authLimiter, validate({ body: forgotPasswordSchema }), auth.forgotPassword);
router.post('/reset-password', authLimiter, validate({ body: resetPasswordSchema }), auth.resetPassword);

export default router;
