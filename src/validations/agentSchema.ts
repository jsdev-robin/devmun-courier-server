import { check } from 'express-validator';

export const agentSchema = [
  check('token').trim().isString(),
  check('familyName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Family name must be between 2 and 50 characters'),

  check('givenName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Given name must be between 2 and 50 characters'),

  check('phone')
    .trim()
    .isLength({ min: 6, max: 20 })
    .withMessage('Phone number must be between 6 and 20 characters'),

  check('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Must be at least 8 characters')
    .matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[\W_]).{8,}$/)
    .withMessage(
      'Must contain uppercase, lowercase, number, and special character'
    ),

  check('passwordConfirm')
    .notEmpty()
    .withMessage('Please confirm your password')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match'),

  check('address.addressLine1')
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Address Line 1 must be between 5 and 100 characters'),

  check('address.addressLine2')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage('Address Line 2 can be max 100 characters'),

  check('address.city')
    .trim()
    .isLength({ min: 2, max: 60 })
    .withMessage('City must be between 2 and 60 characters'),

  check('address.stateDivision')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('State/Division must be between 2 and 50 characters'),

  check('address.zipCode')
    .trim()
    .isLength({ min: 4, max: 10 })
    .withMessage('Zip Code must be between 4 and 10 characters'),

  check('address.landmark')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 100 })
    .withMessage('Landmark can be max 100 characters'),

  check('vehicleType')
    .trim()
    .isLength({ min: 2, max: 30 })
    .withMessage('Vehicle type must be between 2 and 30 characters'),

  check('vehicleNumber')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Vehicle number must be between 3 and 20 characters'),

  check('licenseNumber')
    .trim()
    .isLength({ min: 5, max: 30 })
    .withMessage('License number must be between 5 and 30 characters'),
];
