import express from 'express';
import { adminStatsController } from '../controllers/adminStatsController';
import { authController } from '../controllers/authController';

const router = express.Router();

router.use(
  authController.validateToken,
  authController.requireAuth,
  authController.restrictTo('admin')
);

router.get('/parcel', adminStatsController.readAllParcel);
router.get('/agent', adminStatsController.readAllAgent);
router.put('/agent/assign', adminStatsController.parcelAssignToAgent);
router.get('/customer', adminStatsController.readAllCustomer);

export default router;
