import { check } from 'express-validator';

export const createParcelValidator = [
  check('receiverName').notEmpty().withMessage('Receiver name is required'),
  check('receiverPhone').notEmpty().withMessage('Receiver contact is required'),
  check('pickupAddress').notEmpty().withMessage('Pickup address is required'),
  check('deliveryAddress')
    .notEmpty()
    .withMessage('Delivery address is required'),
  check('parcelType').notEmpty().withMessage('Parcel type is required'),
  check('parcelSize').notEmpty().withMessage('Parcel size is required'),
  check('paymentMethod').notEmpty().withMessage('Payment method is required'),
  check('codAmount').notEmpty().withMessage('COD amount is required'),
  check('pickupLocation.lat')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be a number between -90 and 90'),
  check('pickupLocation.lng')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be a number between -180 and 180'),
];
