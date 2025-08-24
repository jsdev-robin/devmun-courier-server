import express from 'express';
import { config } from '../configs/config';
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

router.post(
  '/signin',
  authSchema.signin,
  runSchema,
  authController.signin,
  authController.createSession()
);

router.post('/refresh-token', authController.refreshToken);

router.post(
  '/verify-2fa/:token',
  authSchema.token,
  runSchema,
  authController.verify2FAOnSign,
  authController.createSession()
);

router.post(
  '/forgot-password',
  authSchema.forgotPasswordRequest,
  runSchema,
  authController.forgotPasswordRequest(config.CLIENT_HUB_ORIGIN)
);
router.put(
  '/reset-password/:token',
  authSchema.resetPasswordRequest,
  runSchema,
  authController.resetPasswordRequest
);

router.use(authController.validateToken, authController.requireAuth);

router.post(
  '/signout',
  authController.restrictTo('customer', 'agent', 'admin'),
  authController.signout
);
router.post(
  '/sessions/:token/revoke',
  authController.restrictTo('customer', 'agent', 'admin'),
  authSchema.token,
  runSchema,
  authController.signoutSession
);
router.post(
  '/sessions/revoke-all',
  authController.restrictTo('customer', 'agent', 'admin'),
  authController.signoutAllSession
);

router.get(
  '/setup-2fa',
  authController.restrictTo('customer', 'agent', 'admin'),
  authController.generate2FASetup
);
router.put(
  '/enable-2fa',
  authController.restrictTo('customer', 'agent', 'admin'),
  authSchema.confirm2FA,
  runSchema,
  authController.confirm2FASetup
);

router.get(
  '/sessions',
  authController.restrictTo('customer', 'agent', 'admin'),
  authController.getSessions
);
router
  .route('/me')
  .all(authController.restrictTo('customer', 'agent', 'admin'))
  .get(authController.getProfile)
  .put(authController.updateAddress);

router.get(
  '/me/fields',
  authSchema.getFields,
  runSchema,
  authController.restrictTo('customer', 'agent', 'admin'),
  authController.getProfileFields
);

export default router;
