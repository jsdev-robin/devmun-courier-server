import { check } from 'express-validator';

export const isEmail = [
  check('email').isEmail().withMessage('Please provide a valid email address'),
];
