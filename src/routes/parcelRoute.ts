import express from 'express';
import { authController } from '../controllers/authController';
import { parcelController } from '../controllers/parcelController';
import { createParcelValidator } from '../validations/parcelSchema';
import { runSchema } from '../validations/runSchema';

const router = express.Router();

router.use(authController.validateToken, authController.requireAuth);

router
  .route('/parcel')
  .all(authController.restrictTo('customer'))
  // .get(parcelController.readCustomerAll)
  .post(createParcelValidator, runSchema, parcelController.createByCustomer);

export default router;
