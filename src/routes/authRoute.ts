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

router.post('/refresh-token', authController.refreshToken);

router.post(
  '/verify-2fa/:token',
  authSchema.token,
  runSchema,
  authController.verify2FAOnSign,
  authController.createSession()
);

router.use(authController.validateToken, authController.requireAuth);

router.post(
  '/signout',
  authController.restrictTo('customer', 'admin'),
  authController.signout
);
router.post(
  '/sessions/:token/revoke',
  authController.restrictTo('customer', 'admin'),
  authSchema.token,
  runSchema,
  authController.signoutSession
);
router.post(
  '/sessions/revoke-all',
  authController.restrictTo('customer', 'admin'),
  authController.signoutAllSession
);

router.get(
  '/setup-2fa',
  authController.restrictTo('customer', 'admin'),
  authController.generate2FASetup
);
router.put(
  '/enable-2fa',
  authController.restrictTo('customer', 'admin'),
  authSchema.confirm2FA,
  runSchema,
  authController.confirm2FASetup
);

router.get(
  '/sessions',
  authController.restrictTo('customer', 'admin'),
  authController.getSessions
);
router
  .route('/me')
  .get(
    authController.restrictTo('customer', 'admin'),
    authController.getProfile
  );
router.get(
  '/me/fields',
  authSchema.getFields,
  runSchema,
  authController.restrictTo('customer', 'admin'),
  authController.getProfileFields
);

export default router;
