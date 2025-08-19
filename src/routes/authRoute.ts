import express from 'express';
import { authController } from '../controllers/authController';
import { authSchema } from '../validations/authSchema';
import { runSchema } from '../validations/runSchema';

const router = express.Router();

router.post('/signup', authSchema.signup, runSchema, authController.signup);
router.post(
  '/verify-email',
  authSchema.verifyEmail,
  runSchema,
  authController.verifyEmail
);

export default router;
