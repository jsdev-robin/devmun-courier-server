import { check, param, query } from 'express-validator';

export const authSchema = {
  token: [param('token').trim().notEmpty().withMessage('Token is required')],

  //  Singup
  signup: [
    check('familyName')
      .trim()
      .notEmpty()
      .withMessage('First name is required')
      .isLength({ min: 2, max: 32 })
      .withMessage('Must be 2-32 characters')
      .custom(
        (value) => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
      )
      .escape(),

    check('givenName')
      .trim()
      .notEmpty()
      .withMessage('Last name is required')
      .isLength({ min: 2, max: 32 })
      .withMessage('Must be 2-32 characters')
      .custom(
        (value) => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
      )
      .escape(),

    check('email')
      .trim()
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Please enter a valid email'),

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
  ],

  // Verify Email
  verifyEmail: [
    check('otp')
      .notEmpty()
      .withMessage('Verification code is required')
      .isNumeric()
      .withMessage('Code must be numeric')
      .isLength({ min: 6, max: 6 })
      .withMessage('Must be 6 digits'),
    check('token').notEmpty().withMessage('Session token is required'),
  ],

  // Signin
  signin: [
    check('email')
      .trim()
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Please enter a valid email'),
    check('password').notEmpty().withMessage('Password is required'),
    check('remember').optional().toBoolean(),
  ],

  // Confiam 2fa
  confirm2FA: [
    check('token').trim().notEmpty().withMessage('Token is required'),
    check('secret').trim().notEmpty().withMessage('Secret is required'),
  ],

  // Password Management
  updatePassword: [
    check('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),

    check('newPassword')
      .notEmpty()
      .withMessage('New password is required')
      .isLength({ min: 8 })
      .withMessage('Must be at least 8 characters')
      .matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[\W_]).{8,}$/)
      .withMessage(
        'Must contain uppercase, lowercase, number, and special character'
      )
      .custom((value, { req }) => value !== req.body.currentPassword)
      .withMessage('New password must be different from current'),

    check('confirmNewPassword')
      .notEmpty()
      .withMessage('Please confirm your new password')
      .custom((value, { req }) => value === req.body.newPassword)
      .withMessage('Passwords do not match'),
  ],

  // forgot password request
  forgotPasswordRequest: [
    check('email')
      .trim()
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Please enter a valid email'),
  ],

  // Reset password request
  resetPasswordRequest: [
    param('token').trim().notEmpty().withMessage('Token is required'),
    check('newPassword')
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ min: 8 })
      .withMessage('Must be at least 8 characters')
      .matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[\W_]).{8,}$/)
      .withMessage(
        'Must contain uppercase, lowercase, number, and special character'
      ),

    check('confirmNewPassword')
      .notEmpty()
      .withMessage('Please confirm your password')
      .custom((value, { req }) => value === req.body.password)
      .withMessage('Passwords do not match'),
  ],

  // Email Management
  updateEmail: [
    check('newEmail')
      .trim()
      .notEmpty()
      .withMessage('New email is required')
      .isEmail()
      .withMessage('Please enter a valid email'),

    check('confirmEmail')
      .trim()
      .notEmpty()
      .withMessage('Please confirm your email')
      .isEmail()
      .withMessage('Please enter a valid email')
      .custom((value, { req }) => value === req.body.newEmail)
      .withMessage('Emails do not match')
      .custom((value, { req }) => value !== req.self?.email)
      .withMessage('New email must be different from current email'),

    check('password')
      .notEmpty()
      .withMessage('Password is required for verification'),
  ],

  getFields: [
    check('mun')
      .optional({ nullable: true })
      .isString()
      .withMessage('mun must be a string'),
    query('fields')
      .trim()
      .notEmpty()
      .withMessage('Fields is required')
      .isString()
      .withMessage('Fields must be a string'),
  ],
};
