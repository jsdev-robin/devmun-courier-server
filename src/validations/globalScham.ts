import { param } from 'express-validator';

export const validateId = [
  param('id').isMongoId().withMessage('Invalid user ID'),
];
