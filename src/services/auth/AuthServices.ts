import { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Model } from 'mongoose';
import { config } from '../../configs/config';
import { ApiError } from '../../middlewares/errors/ApiError';
import { IUser, UserRole } from '../../models/userModel';
import { Crypto, Decipheriv } from '../../security/Crypto';
import { ISignupRequest, IVerifyEmailRequest } from '../../types/authTypes';
import { catchAsync } from '../../utils/catchAsync';
import HttpStatusCode from '../../utils/httpStatusCode';
import { Status } from '../../utils/status';
import { SendMail } from '../email/SendMail';
import { AuthEngine } from './engine/AuthEngine';

export class AuthService extends AuthEngine {
  constructor(options: { model: Model<IUser>; role: UserRole }) {
    super(options);
  }

  public signup = catchAsync(
    async (
      req: ISignupRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      // Destructure user input from request body
      const { familyName, givenName, email, password } = req.body;

      // Normalize the email for consistency (e.g., lowercase, trimmed)
      const normEmail = this.normalizeMail(email);

      // Check if a user already exists with the same email or normalized email
      const userExists = await this.model
        .findOne({
          $or: [{ email }, { normalizeMail: normEmail }],
        })
        .exec();

      // If user exists, return a 400 error with message
      if (userExists) {
        return next(
          new ApiError(
            'This email is already registered. Use a different email address.',
            HttpStatusCode.BAD_REQUEST
          )
        );
      }

      // Prepare user data for OTP creation and storage
      const data = {
        familyName,
        givenName,
        email,
        normalizeMail: normEmail,
        password,
      };

      // Generate OTP and token for email verification
      const { token, solidOTP } = await this.creatOtp(req, data);

      // Prepare data for the verification email
      const mailData = {
        user: {
          name: familyName,
          email,
        },
        otp: solidOTP,
      };

      // Send verification email and respond accordingly
      await new SendMail(mailData)
        .verifyEmail()
        .then(() => {
          // On success, send OK response with verification token
          res.status(HttpStatusCode.OK).json({
            status: Status.SUCCESS,
            message:
              'Verification code sent successfully to your email address.',
            data: {
              token,
            },
          });
        })
        .catch(() => {
          // On failure, pass error to the next middleware
          return next(
            new ApiError(
              'An error occurred while sending the verification email. Please try again later.',
              HttpStatusCode.INTERNAL_SERVER_ERROR
            )
          );
        });
    }
  );

  public verifyEmail = catchAsync(
    async (
      req: IVerifyEmailRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      // Destructure OTP and token from request body
      const { otp, token } = req.body;

      // Verify JWT token and extract the encrypted payload
      const { encrypted } = jwt.verify(token, config.ACTIVATION_SECRET) as {
        encrypted: Decipheriv;
      };

      // Decrypt the encrypted payload to retrieve user information
      const {
        familyName,
        givenName,
        email,
        normalizeMail,
        password,
        solidOTP,
      } = await Crypto.decipheriv<{
        familyName: string;
        givenName: string;
        email: string;
        normalizeMail: string;
        password: string;
        solidOTP: string;
      }>(encrypted, config.CRYPTO_SECRET);

      const aBuf = String(solidOTP);
      const bBuf = String(otp);

      const correctOTP = Crypto.safeCompare(aBuf, bBuf);

      // Compare provided OTP with the decrypted solidOTP
      if (!correctOTP) {
        return next(
          new ApiError(
            'The OTP you entered does not match. Please double-check the code and try again.',
            HttpStatusCode.BAD_REQUEST
          )
        );
      }

      // Construct the user payload including email verification log
      const payload = {
        familyName,
        givenName,
        email: email,
        normalizeMail: normalizeMail,
        password: password,
        verified: true,
      };

      // Create a new user record if OTP matches
      await this.model.create(payload);

      // Respond with a success message
      res.status(HttpStatusCode.CREATED).json({
        status: Status.SUCCESS,
        message: 'Your account has been successfully verified.',
      });
    }
  );
}
