import { check } from 'express-validator';

export const addressSchema = [
  check('addressLine1')
    .optional()
    .isLength({ min: 5, max: 100 })
    .withMessage('Address Line 1 must be between 5 and 100 characters'),

  check('addressLine2')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Address Line 2 must be at most 100 characters'),

  check('city')
    .optional()
    .isLength({ min: 2, max: 60 })
    .withMessage('City must be between 2 and 60 characters'),

  check('stateDivision')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Division must be between 2 and 50 characters'),

  check('zipCode')
    .optional()
    .isLength({ min: 4, max: 10 })
    .withMessage('ZIP code must be between 4 and 10 characters'),

  check('landmark')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Landmark must be at most 100 characters'),

  check('location.lat')
    .optional()
    .isNumeric()
    .withMessage('Latitude must be a number'),

  check('location.lng')
    .optional()
    .isNumeric()
    .withMessage('Longitude must be a number'),
];
