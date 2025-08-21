import { check } from 'express-validator';

export const createParcelValidator = [
  check('receiverName')
    .isString()
    .withMessage('Receiver name must be a string')
    .notEmpty()
    .withMessage('Receiver name is required'),

  check('receiverPhone')
    .isString()
    .withMessage('Receiver phone must be a string')
    .notEmpty()
    .withMessage('Receiver phone is required'),

  check('pickupAddress')
    .isString()
    .withMessage('Pickup address must be a string')
    .notEmpty()
    .withMessage('Pickup address is required'),

  check('deliveryAddress')
    .isString()
    .withMessage('Delivery address must be a string')
    .notEmpty()
    .withMessage('Delivery address is required'),

  check('parcelType')
    .isIn(['document', 'package', 'fragile', 'electronics'])
    .withMessage('Invalid parcel type'),

  check('parcelSize')
    .isIn(['small', 'medium', 'large', 'xlarge'])
    .withMessage('Invalid parcel size'),

  check('paymentMethod')
    .isIn(['prepaid', 'cod'])
    .withMessage('Invalid payment method'),

  check('codAmount').isNumeric().withMessage('COD Amount must be a number'),

  check('pickupLocation')
    .optional()
    .isObject()
    .withMessage('Pickup location must be an object'),

  check('pickupLocation.lat')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),

  check('pickupLocation.lng')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
];
