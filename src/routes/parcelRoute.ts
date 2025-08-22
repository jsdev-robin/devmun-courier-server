import express from 'express';
import { authController } from '../controllers/authController';
import { parcelController } from '../controllers/parcelController';
import { validateId } from '../validations/globalScham';
import { createParcelValidator } from '../validations/parcelSchema';
import { runSchema } from '../validations/runSchema';

const router = express.Router();

router.use(authController.validateToken, authController.requireAuth);

router
  .route('/parcel')
  .all(authController.restrictTo('customer'))
  .get(parcelController.readCustomerAll)
  .post(createParcelValidator, runSchema, parcelController.createByCustomer);

router
  .route('/parcel/:id')
  .all(authController.restrictTo('customer'))
  .get(validateId, runSchema, parcelController.readCustomerById);

router
  .route('/parcel/agent/assign/:id')
  .all(authController.restrictTo('agent'))
  .put(validateId, runSchema, parcelController.acceptParcelByAgent);

export default router;
