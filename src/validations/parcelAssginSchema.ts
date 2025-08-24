import { check } from 'express-validator';

export const parcelAssingSchema = [
  check('parcelId')
    .notEmpty()
    .withMessage('parcelId is required')
    .isMongoId()
    .withMessage('Invalid parcelId'),

  check('agentId')
    .notEmpty()
    .withMessage('agentId is required')
    .isMongoId()
    .withMessage('Invalid agentId'),

  check('priority').notEmpty().withMessage('priority is required'),

  check('notes')
    .optional()
    .isString()
    .withMessage('notes must be a string')
    .isLength({ max: 500 })
    .withMessage('notes can be max 500 characters'),
];
