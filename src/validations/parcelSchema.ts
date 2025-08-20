import { check } from 'express-validator';

export const createParcelValidator = [
  // check('agent')
  //   .optional()
  //   .custom((value) => mongoose.Types.ObjectId.isValid(value))
  //   .withMessage('Invalid agent ID'),

  check('pickupAddress').notEmpty().withMessage('Pickup address is required'),

  check('deliveryAddress')
    .notEmpty()
    .withMessage('Delivery address is required'),

  check('size')
    .notEmpty()
    .withMessage('Size is required')
    .isIn(['small', 'medium', 'large'])
    .withMessage('Size must be small, medium, or large'),

  check('type')
    .notEmpty()
    .withMessage('Type is required')
    .isIn(['COD', 'Prepaid'])
    .withMessage('Type must be COD or Prepaid'),

  check('amount')
    .isNumeric()
    .withMessage('Amount must be a number')
    .custom((value) => value >= 0)
    .withMessage('Amount must be >= 0'),

  check('status')
    .optional()
    .isIn(['Booked', 'Picked Up', 'In Transit', 'Delivered', 'Failed'])
    .withMessage('Invalid status value'),

  check('history.*.status')
    .optional()
    .isString()
    .withMessage('History status must be string'),

  check('history.*.location.lat')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),

  check('history.*.location.lng')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
];
