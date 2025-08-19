import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Model } from 'mongoose';
import { config } from '../../configs/config';
import { ApiError } from '../../middlewares/errors/ApiError';
import { IUser, UserRole } from '../../models/userModel';
import { Crypto, Decipheriv } from '../../security/Crypto';
import {
  ISigninRequest,
  ISignupRequest,
  IVerifyEmailRequest,
} from '../../types/authTypes';
import { catchAsync } from '../../utils/catchAsync';
import HttpStatusCode from '../../utils/httpStatusCode';
import { Status } from '../../utils/status';
import { SendMail } from '../email/SendMail';
import { AuthEngine } from './engine/AuthEngine';
import { TokenSignature } from './engine/TokenService';

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
      const { familyName, givenName, email, phone, password } = req.body;

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
        phone,
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
        phone,
        normalizeMail,
        password,
        solidOTP,
      } = await Crypto.decipheriv<{
        familyName: string;
        givenName: string;
        email: string;
        phone: string;
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
        phone: phone,
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

  public signin = catchAsync(
    async (
      req: ISigninRequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      // Extract login fields from request body
      const { email, password, remember } = req.body;

      // Look up user by email, including password
      const user = await this.model
        .findOne({ email })
        .select('+password')
        .exec();

      // Validate user existence and password
      if (!user || !(await user.isPasswordValid(password))) {
        return next(
          new ApiError(
            'Incorrect email or password. Please check your credentials and try again.',
            HttpStatusCode.UNAUTHORIZED
          )
        );
      }

      // Check if 2FA is enabled for this user
      if (user?.twoFA?.enabled) {
        await this.pending2FA(res, { id: user.id, remember: remember });
        res.status(HttpStatusCode.OK).json({
          status: Status.SUCCESS,
          message:
            'Sign-in successful. Please complete two-factor authentication.',
          data: {
            enable2fa: true,
          },
        });
        return;
      }

      // Remove sensitive password field before continuing
      user.password = undefined;

      // Attach authenticated user and session preference to request object
      req.self = user;
      req.remember = remember;
      next();
    }
  );

  public createSession = (url?: string) =>
    catchAsync(
      async (
        req: Request,
        res: Response,
        next: NextFunction
      ): Promise<void> => {
        // Extracts user, remember flag, and redirect flag from request
        const user = req.self;
        const remember = req.remember;
        const redirect = req.redirect;

        // Rotates and generates new access and refresh tokens using user's ID and role
        const [accessToken, refreshToken, protectToken] = this.rotateToken(
          req,
          {
            id: user._id,
            role: user.role,
            remember,
          }
        );

        // Sets access token as a cookie
        res.cookie(...this.createCookie('access', accessToken, remember));
        // Sets refresh token as a cookie
        res.cookie(...this.createCookie('refresh', refreshToken, remember));
        // Sets protect token as a cookie
        res.cookie(...this.createCookie('protect', protectToken, remember));
        // Clear 2fa pending cookie
        this.clearCookie(res, 'pending2FA');

        // Stores the session in a storage system (e.g., DB, Redis, etc.)
        await this.storeSession(req, { user, accessToken });

        try {
          if (redirect) {
            // If redirect flag is true, redirect to the provided URL with user role as query param
            res.redirect(`${url}?role=${user?.role}`);
          } else {
            // Otherwise, respond with a success message and the user's role
            res.status(HttpStatusCode.OK).json({
              status: Status.SUCCESS,
              message: `Welcome back ${user?.familyName}.`,
              data: {
                role: user?.role ?? 'user',
              },
            });
          }
        } catch (error) {
          // If headers haven't been sent yet, clear cookies and pass error to next handler
          if (!res.headersSent) {
            this.clearAllCookies(res);
          }
          next(error);
        }
      }
    );

  public refreshToken = catchAsync(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      // Get refresh token from cookies
      const refreshCookie = req.cookies[this.getCookieNames().refresh];

      // Exit early if no refresh token is found
      if (!refreshCookie) {
        return this.sessionUnauthorized(res, next);
      }

      try {
        // Verify and decode the refresh token payload
        const decode = jwt.verify(
          refreshCookie,
          config.REFRESH_TOKEN
        ) as TokenSignature;

        if (this.checkTokenSignature(decode, req)) {
          return this.sessionUnauthorized(res, next);
        }

        const { remember, id, role, token } = decode;

        // Rotate access and refresh tokens
        const [accessToken, refreshToken, protectToken] = this.rotateToken(
          req,
          {
            id: id,
            role: role,
            remember: remember,
          }
        );

        // Sets access token as a cookie
        res.cookie(...this.createCookie('access', accessToken, remember));
        // Sets refresh token as a cookie
        res.cookie(...this.createCookie('refresh', refreshToken, remember));
        // Sets protect token as a cookie
        res.cookie(...this.createCookie('protect', protectToken, remember));

        // Hash new access token for Redis and DB session comparison
        const oldToken = token;
        const newToken = accessToken;

        await this.rotateSession({
          id: id,
          oldToken,
          newToken,
        });

        // Respond with success message
        res.status(200).json({
          status: Status.SUCCESS,
          message: 'Token refreshed successfully.',
        });
      } catch (error) {
        // If headers haven't been sent yet, clear cookies and pass error to next handler
        if (!res.headersSent) {
          this.clearAllCookies(res);
        }
        next(error);
      }
    }
  );

  public signout = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const accessToken = req.signedCookies[this.getCookieNames().access];
      const user = req.self;
      await this.removeASession(res, {
        id: user._id,
        token: Crypto.hmac(accessToken),
      });

      this.clearAllCookies(res);

      res.status(HttpStatusCode.OK).json({
        status: Status.SUCCESS,
        message: 'You have been successfully signed out.',
      });
    }
  );

  public signoutSession = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      // Extract the session token from request parameters
      const { token } = req.params;
      const user = req.self;

      await this.removeASession(res, {
        id: user._id,
        token: token,
      });

      // Send a success response indicating logout completion
      res.status(HttpStatusCode.OK).json({
        status: Status.SUCCESS,
        message: 'You have been successfully logged out.',
      });
    }
  );

  public signoutAllSession = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const user = req.self;

      await this.removeOtherSessions(req, {
        id: user.id,
      });

      res.status(HttpStatusCode.OK).json({
        status: Status.SUCCESS,
        message: 'You have been successfully logged out.',
      });
    }
  );
}
