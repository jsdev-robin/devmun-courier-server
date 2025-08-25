import { check, param } from 'express-validator';

export const agentParcelUpdateSchema = [
  param('id')
    .notEmpty()
    .withMessage('Parcel ID is required')
    .isMongoId()
    .withMessage('Parcel ID must be a valid Mongo ID'),

  check('status')
    .notEmpty()
    .withMessage('Status is required')
    .isString()
    .withMessage('Status must be a string'),

  check('notes').optional().isString().withMessage('Notes must be a string'),
];
