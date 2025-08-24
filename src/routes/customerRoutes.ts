import express from 'express';
import { authController } from '../controllers/authController';
import { customerStatsController } from '../controllers/customerStatsController';
import { createParcelValidator } from '../validations/parcelSchema';
import { runSchema } from '../validations/runSchema';

const router = express.Router();

router.use(
  authController.validateToken,
  authController.requireAuth,
  authController.restrictTo('customer')
);

router.route('/parcel').get(customerStatsController.readAllParcel);

router
  .route('/parcel/:id')
  .put(customerStatsController.createByCustomer)
  .get(customerStatsController.readById);

router
  .route('/parcel')
  .get(customerStatsController.readAllParcel)
  .post(
    createParcelValidator,
    runSchema,
    customerStatsController.createByCustomer
  );

export default router;
