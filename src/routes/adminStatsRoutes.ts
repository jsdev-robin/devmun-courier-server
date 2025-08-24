import express from 'express';
import multer from 'multer';
import { adminStatsController } from '../controllers/adminStatsController';
import { authController } from '../controllers/authController';
import { parseJson } from '../middlewares/parseJson';
import { agentSchema } from '../validations/agentSchema';
import { isEmail } from '../validations/emailCheck';
import { parcelAssingSchema } from '../validations/parcelAssginSchema';
import { runSchema } from '../validations/runSchema';
const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

router.post(
  '/agent/create',
  upload.single('img'),
  parseJson,
  agentSchema,
  runSchema,
  adminStatsController.createAgent
);

router.use(
  authController.validateToken,
  authController.requireAuth,
  authController.restrictTo('admin')
);

router.get('/parcel', adminStatsController.readAllParcel);
router.get('/agent', adminStatsController.readAllAgent);
router.post(
  '/agent/invite',
  isEmail,
  runSchema,
  adminStatsController.inviteNewAgnet
);

router.put(
  '/agent/assign',
  parcelAssingSchema,
  runSchema,
  adminStatsController.parcelAssignToAgent
);
router.get('/customer', adminStatsController.readAllCustomer);
router.get(
  '/analytics/status-distribution',
  adminStatsController.parcelStatusDistribution
);

export default router;
