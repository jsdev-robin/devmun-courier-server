import express from 'express';
import { agentStatsController } from '../controllers/agentStatsController';
import { authController } from '../controllers/authController';

const router = express.Router();

router.use(
  authController.validateToken,
  authController.requireAuth,
  authController.restrictTo('agent')
);

router.route('/parcel').get(agentStatsController.readAllParcel);

router.route('/parcel/:id').put(agentStatsController.updateStatusByAgent);

router.route('/parcel/analytics').get(agentStatsController.getParcelAnalytics);

export default router;
