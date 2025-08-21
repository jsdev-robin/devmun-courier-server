import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Model } from 'mongoose';
import { Profile as DiscordProfile } from 'passport-discord';
import { Profile as FacebookProfile } from 'passport-facebook';
import { Profile as GoogleProfile } from 'passport-google-oauth20';
import { Profile as TwitterProfile } from 'passport-twitter';
import QRCode from 'qrcode';
import speakeasy from 'speakeasy';
import { config } from '../../configs/config';
import { nodeClient } from '../../configs/redis';
import { ApiError } from '../../middlewares/errors/ApiError';
import { IUser, UserRole } from '../../models/userModel';
import { Crypto, Decipheriv } from '../../security/Crypto';
import {
  IConfirm2FARequest,
  ISigninRequest,
  ISignupRequest,
  IVerifyEmailRequest,
} from '../../types/authTypes';
import { GitHubProfileJson } from '../../types/passport';
import { catchAsync } from '../../utils/catchAsync';
import HttpStatusCode from '../../utils/httpStatusCode';
import { Status } from '../../utils/status';
import { SendMail } from '../email/SendMail';
import { AuthEngine } from './engine/AuthEngine';
import { REFRESH_TTL } from './engine/CookieService';
import { TokenSignature } from './engine/TokenService';

export class AuthService extends AuthEngine {
  constructor(options: { model: Model<IUser> }) {
    super(options);
  }

  private oauth = async <T>(
    req: Request,
    res: Response,
    next: NextFunction,
    provider: string,
    options: {
      profileExtractor: (profile: T) => {
        email?: string;
        verified?: boolean;
        familyName?: string;
        givenName?: string;
        avatarUrl?: string;
      };
    }
  ): Promise<void> => {
    const profile = req.user as T;
    const { email, verified, familyName, givenName, avatarUrl } =
      options.profileExtractor(profile);

    // Check if user exists in the database
    const userExists = await this.model
      .findOne({
        $or: [{ email }, { normalizeMail: email }],
      })
      .select('auth twoFA')
      .exec();

    if (userExists) {
      const providerExists = userExists.auth?.some(
        (entry) => entry.provider === provider
      );

      if (!providerExists) {
        await this.model.updateOne(
          { _id: userExists._id },
          {
            $push: {
              auth: {
                provider,
                _raw: req.user,
              },
            },
          }
        );
      }

      // Check if 2FA is enabled for this user
      if (userExists?.twoFA?.enabled) {
        await this.pending2FA(res, { id: userExists.id, remember: true });
        return res.redirect('http://localhost:3001/sign-in/verify-2fa');
      }

      req.self = await this.model.findById(userExists._id);
      req.remember = true;
      req.redirect = true;
      return next();
    }

    // Create new user from social profile
    const newUser = await this.model.create({
      familyName,
      givenName,
      email,
      normalizeMail: email,
      verified,
      avatar: {
        url: avatarUrl,
      },
      auth: [
        {
          provider,
          _raw: req.user,
        },
      ],
    });

    req.self = newUser;
    req.remember = true;
    req.redirect = true;
    next();
  };

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

  public googleAuth = catchAsync(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      await this.oauth<GoogleProfile>(req, res, next, 'google', {
        profileExtractor: (profile) => ({
          email: profile._json?.email,
          verified: profile._json?.email_verified,
          familyName: profile._json?.given_name,
          givenName: profile._json?.family_name,
          avatarUrl: profile._json.picture,
        }),
      });
    }
  );

  public githubAuth = catchAsync(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      await this.oauth<{ _json: GitHubProfileJson }>(req, res, next, 'github', {
        profileExtractor: (profile) => ({
          email: profile._json?.email,
          verified: true,
          familyName: profile._json?.name?.split(' ')[0],
          givenName: profile._json?.name?.split(' ')[1],
          avatarUrl: profile._json.avatar_url,
        }),
      });
    }
  );

  public twitterAuth = catchAsync(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      await this.oauth<TwitterProfile>(req, res, next, 'twitter', {
        profileExtractor: (profile) => ({
          email: profile._json?.email,
          verified: true,
          familyName: profile._json?.name?.split(' ')[0],
          givenName: profile._json?.name?.split(' ')[1],
          avatarUrl: profile._json.profile_image_url,
        }),
      });
    }
  );

  public facebookAuth = catchAsync(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      await this.oauth<FacebookProfile>(req, res, next, 'facebook', {
        profileExtractor: (profile) => ({
          email: profile._json?.email || profile._json.id,
          verified: true,
          familyName: profile._json?.name?.split(' ')[0],
          givenName: profile._json?.name?.split(' ')[1],
          avatarUrl: profile._json.picture?.data?.url,
        }),
      });
    }
  );

  public discordAuth = catchAsync(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      await this.oauth<DiscordProfile>(req, res, next, 'discord', {
        profileExtractor: (profile) => ({
          email: profile.email,
          verified: profile.verified,
          familyName: profile.global_name?.split(' ')[0],
          givenName: profile.global_name?.split(' ')[1],
          avatarUrl: `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`,
        }),
      });
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

  public validateToken = catchAsync(
    async (
      req: Request<Record<string, string>, unknown> & {
        userId?: string | undefined;
        accessToken?: string | undefined;
      },
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      const accessCookie = req.signedCookies[this.getCookieNames().access];

      // If the access token is missing, throw an unauthorized error
      if (accessCookie === false) {
        return next(
          new ApiError(
            'Your session has expired or is no longer available. Please log in again to continue.',
            HttpStatusCode.UNAUTHORIZED
          )
        );
      }

      // Verify the access token and decode the payload
      const decoded = jwt.verify(accessCookie, config.ACCESS_TOKEN) as {
        id: string;
      } & TokenSignature;

      // Attach user ID and access token to the request object
      req.userId = decoded?.id;
      req.accessToken = accessCookie;

      // // Validate the decrypted IP against the request IP
      // if (this.checkTokenSignature(decoded, req)) {
      //   return this.sessionUnauthorized(res, next);
      // }

      next();
    }
  );

  public requireAuth = catchAsync(
    async (
      req: Request<unknown, unknown, unknown> & {
        userId?: string | undefined;
        accessToken?: string | undefined;
      },
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      // Get credentials from request
      const { userId, accessToken } = req;

      // Query session and user data from Redis
      const p = nodeClient.multi();
      p.SISMEMBER(`${userId}:session`, Crypto.hmac(String(accessToken)));
      p.json.GET(`${userId}`);

      const [sessionToken, user] = await p.exec();

      // Invalidate if session/user not found
      if (!sessionToken || !user) {
        return this.sessionUnauthorized(res, next);
      }

      req.self = user;
      next();
    }
  );

  public restrictTo = (...roles: UserRole[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = req.self;
      if (!user?.role || !roles.includes(user.role)) {
        return next(
          new ApiError(
            'You do not have permission to perform this action',
            HttpStatusCode.FORBIDDEN
          )
        );
      }

      next();
    };
  };

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

  public generate2FASetup = catchAsync(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const user = req.self;

      const secret = speakeasy.generateSecret({
        name: `Devmun:${Crypto.hash(user?.email)}`,
      });

      if (!secret.otpauth_url) {
        return next(
          new ApiError(
            'Failed to generate otpauth_url',
            HttpStatusCode.INTERNAL_SERVER_ERROR
          )
        );
      }

      const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

      res.status(HttpStatusCode.OK).json({
        status: 'success',
        message: '2FA setup generated successfully.',
        data: {
          secret: secret.base32,
          otpauth_url: secret.otpauth_url,
          qrCodeDataUrl,
        },
      });
    }
  );

  public confirm2FASetup = catchAsync(
    async (
      req: IConfirm2FARequest,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      const { token, secret } = req.body;

      const isVerified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 1,
      });

      if (!isVerified) {
        return next(
          new ApiError(
            'Invalid or expired 2FA token.',
            HttpStatusCode.UNAUTHORIZED
          )
        );
      }

      const encryptedKey = await Crypto.cipheriv(secret, config.CRYPTO_SECRET);

      const user = await this.model.findByIdAndUpdate(
        req.self._id,
        {
          $set: {
            'twoFA.enabled': true,
            'twoFA.secret': encryptedKey,
          },
        },
        { new: true }
      );

      const p = nodeClient.multi();
      p.json.SET(
        `${user?._id}`,
        '$',
        JSON.parse(JSON.stringify(user?.toObject()))
      );
      p.EXPIRE(`${user?._id}`, REFRESH_TTL * 24 * 60 * 60);
      await p.exec();

      res.status(HttpStatusCode.OK).json({
        status: 'success',
        message: '2FA has been confirmed and enabled.',
      });
    }
  );

  public verify2FAOnSign = catchAsync(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const pending2FACookie = req.cookies[this.getCookieNames().pending2FA];
      const { token } = req.params;

      const { encrypted } = jwt.verify(
        pending2FACookie,
        config.ACTIVATION_SECRET
      ) as {
        encrypted: Decipheriv;
      };

      const { id, remember } = await Crypto.decipheriv<{
        id: string;
        remember: boolean;
      }>(encrypted, config.CRYPTO_SECRET);

      const [secureUser, basicUser] = await Promise.all([
        this.model.findById({ _id: id }).select('twoFA'),
        this.model.findById({ _id: id }),
      ]);

      const secretKey = secureUser?.twoFA.secret as Decipheriv;

      const base32Secret = await Crypto.decipheriv<string>(
        secretKey,
        config.CRYPTO_SECRET
      );

      const isVerified = speakeasy.totp.verify({
        secret: base32Secret ?? '',
        encoding: 'base32',
        token,
        window: 1,
      });

      if (!isVerified) {
        return next(
          new ApiError(
            'Invalid or expired 2FA token. Check your Google Authenticator app and try again.',
            HttpStatusCode.UNAUTHORIZED
          )
        );
      }

      req.self = basicUser;
      req.remember = remember;
      next();
    }
  );

  public getSessions = catchAsync(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      // Get authenticated user from request
      const user = req.self;

      // Return error if no user found
      if (!user) {
        return next(
          new ApiError(
            'No user found. Please log in again to access your account.',
            HttpStatusCode.BAD_REQUEST
          )
        );
      }

      // Query user's session tokens with:
      const data = await this.model
        .findById(user._id)
        .select({
          sessions: {
            $map: {
              input: {
                $sortArray: {
                  input: '$sessions',
                  sortBy: { loggedInAt: -1 },
                },
              },
              as: 'token',
              in: {
                token: '$$token.token',
                deviceInfo: '$$token.deviceInfo',
                location: '$$token.location',
                ip: '$$token.ip',
                loggedInAt: '$$token.loggedInAt',
                status: '$$token.status',
              },
            },
          },
          _id: 0,
        })
        .lean()
        .exec();
      // Return sorted session history
      res.status(HttpStatusCode.OK).json({
        status: Status.SUCCESS,
        message: 'Sign-in history fetched successfully.',
        data,
      });
    }
  );

  public getProfile = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      // User is already attached to request via auth middleware
      const user = req.self;

      // Consider returning only necessary profile data
      res.status(HttpStatusCode.OK).json({
        status: Status.SUCCESS,
        message: 'Profile retrieved successfully',
        data: {
          user,
        },
      });
    }
  );

  public getProfileFields = catchAsync(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const query = this.sanitizeFields(req.query, 'fields');

      // Explicitly include settings fields in projection
      const user = await this.model
        .findById(req.self?._id)
        .select(String(query).split(',').join(' '))
        .lean()
        .exec();

      if (!user) {
        return next(
          new ApiError(
            'No user found. Please log in again to access your account.',
            HttpStatusCode.NOT_FOUND
          )
        );
      }

      // Return only what was requested (or add warning if you need to keep current behavior)
      res.status(HttpStatusCode.OK).json({
        status: Status.SUCCESS,
        message: 'User fields retrieved successfully',
        data: {
          user,
        },
      });
    }
  );
}
