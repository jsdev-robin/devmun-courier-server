import { randomInt } from 'crypto';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../../configs/config';
import { nodeClient } from '../../../configs/redis';
import { ApiError } from '../../../middlewares/errors/ApiError';
import { IUser } from '../../../models/userModel';
import { Crypto } from '../../../security/Crypto';
import HttpStatusCode from '../../../utils/httpStatusCode';
import { ACCESS_TTL, REFRESH_TTL } from './CookieService';
import { TokenService } from './TokenService';

export class AuthEngine extends TokenService {
  protected getDeviceInfo = (req: Request) => {
    const ua = req.useragent;
    const deviceType = ua?.isSmartTV
      ? 'smart-tv'
      : ua?.isBot
      ? 'bot'
      : ua?.isMobileNative
      ? 'mobile-native'
      : ua?.isMobile
      ? 'mobile'
      : ua?.isTablet
      ? 'tablet'
      : ua?.isAndroidTablet
      ? 'android-tablet'
      : ua?.isiPad
      ? 'ipad'
      : ua?.isiPhone
      ? 'iphone'
      : ua?.isiPod
      ? 'ipod'
      : ua?.isKindleFire
      ? 'kindle-fire'
      : ua?.isDesktop
      ? 'desktop'
      : ua?.isWindows
      ? 'windows'
      : ua?.isMac
      ? 'mac'
      : ua?.isLinux
      ? 'linux'
      : ua?.isChromeOS
      ? 'chromeos'
      : ua?.isRaspberry
      ? 'raspberry-pi'
      : 'unknown';

    return {
      deviceType,
      os: ua?.os ?? 'unknown',
      browser: ua?.browser ?? 'unknown',
      userAgent: req.headers['user-agent'] ?? 'unknown',
      ip: req.ip,
      date: Date.now(),
      ...this.getLocationInfo(req),
    };
  };

  protected getLocationInfo = (req: Request) => ({
    city: req.ipinfo?.city || 'unknown',
    country: req.ipinfo?.country || 'unknown',
    lat: Number(req.ipinfo?.loc?.split(',')[0]) || 0,
    lng: Number(req.ipinfo?.loc?.split(',')[1]) || 0,
  });

  protected creatOtp = async (
    req: Request,
    data: object
  ): Promise<{ token: string; solidOTP: number }> => {
    try {
      const otpMin = Math.pow(10, 6 - 1);
      const otpMax = Math.pow(10, 6) - 1;

      const solidOTP = randomInt(otpMin, otpMax);

      const encrypted = await Crypto.cipheriv(
        {
          ...data,
          solidOTP,
          ip: req.ip,
        },
        config.CRYPTO_SECRET
      );

      const token = jwt.sign({ encrypted }, config.ACTIVATION_SECRET, {
        expiresIn: '10m',
      });

      return { token, solidOTP };
    } catch {
      throw new ApiError(
        'Failed to create OTP. Please try again.',
        HttpStatusCode.INTERNAL_SERVER_ERROR
      );
    }
  };

  protected normalizeMail = (email: string): string => {
    const [localPart, domain] = email.split('@');

    if (domain.toLowerCase() === 'gmail.com') {
      return localPart.replace(/\./g, '') + '@gmail.com';
    }

    return email.toLowerCase();
  };

  protected storeSession = async (
    req: Request,
    payload: {
      user: IUser;
      accessToken: string;
    }
  ): Promise<void> => {
    try {
      const { user, accessToken } = payload;
      const { _id } = user;
      const hashedToken = Crypto.hmac(String(accessToken));

      await Promise.all([
        // Redis operations
        (async () => {
          const p = nodeClient.multi();
          p.SADD(`${_id}:session`, hashedToken);
          p.json.SET(`${_id}`, '$', user.toObject());
          p.EXPIRE(`${_id}:session`, ACCESS_TTL * 24 * 60 * 60);
          p.EXPIRE(`${_id}`, REFRESH_TTL * 24 * 60 * 60);
          await p.exec();
        })(),

        // MongoDB operations
        this.model
          .findByIdAndUpdate(
            { _id: _id },
            {
              $push: {
                sessions: {
                  token: hashedToken,
                  deviceInfo: this.getDeviceInfo(req),
                  location: this.getLocationInfo(req),
                  ip: req.ip,
                },
              },
            },
            { new: true }
          )
          .exec(),
      ]);
    } catch {
      throw new ApiError(
        'Failed to store session',
        HttpStatusCode.INTERNAL_SERVER_ERROR
      );
    }
  };

  protected rotateSession = async (payload: {
    id: string;
    oldToken: string;
    newToken: string;
  }): Promise<void> => {
    try {
      const { id, oldToken, newToken } = payload;
      const hashedToken = Crypto.hmac(String(newToken));
      await Promise.all([
        // Redis: replace old token with new one
        (async () => {
          const p = nodeClient.multi();
          p.SREM(`${id}:session`, String(oldToken));
          p.SADD(`${id}:session`, hashedToken);
          p.EXPIRE(`${id}:session`, REFRESH_TTL * 24 * 60 * 60);
          await p.exec();
        })(),

        // DB: update token inside sessionToken array
        this.model
          .findByIdAndUpdate(
            { _id: id },
            {
              $set: {
                'sessions.$[elem].token': hashedToken,
              },
            },
            {
              arrayFilters: [{ 'elem.token': oldToken }],
              new: true,
            }
          )
          .exec(),
      ]);
    } catch {
      throw new ApiError(
        'Failed to rotate session. Please try again later.',
        HttpStatusCode.INTERNAL_SERVER_ERROR
      );
    }
  };

  protected removeASession = async (
    res: Response,
    payload: {
      id: string;
      token: string;
    }
  ): Promise<void> => {
    try {
      const { id, token } = payload;

      await Promise.all([
        // Redis session removal
        (async () => {
          const p = nodeClient.multi();
          p.SREM(`${id}:session`, token);
          const [rem] = await p.exec();

          // Ensure the token was actually removed
          if (Number(rem) !== 1) {
            throw new Error('Token not found in session set.');
          }
        })(),

        // DB session token status update
        await this.model
          .findByIdAndUpdate(
            { _id: id },
            {
              $set: {
                'sessions.$[elem].status': false,
              },
            },
            {
              arrayFilters: [{ 'elem.token': token }],
              new: true,
            }
          )
          .exec(),
      ]);
    } catch {
      throw new ApiError(
        'Failed to remove session. Please try again later.',
        HttpStatusCode.INTERNAL_SERVER_ERROR
      );
    }
  };

  protected removeAllSessions = async (payload: {
    id: string;
  }): Promise<void> => {
    try {
      const { id } = payload;
      await Promise.all([
        // Clear all Redis session and user cache
        (async () => {
          const p = nodeClient.multi();
          p.DEL(`${id}:session`);
          p.DEL(`${id}`);
          await p.exec();
        })(),

        // Unset all sessionToken entries from database
        this.model.updateOne({ _id: id }, { $unset: { sessions: '' } }).exec(),
      ]);
    } catch {
      throw new ApiError(
        'Failed to remove all sessions.',
        HttpStatusCode.INTERNAL_SERVER_ERROR
      );
    }
  };

  protected removeOtherSessions = async (
    req: Request,
    payload: {
      id: string;
    }
  ): Promise<void> => {
    try {
      const { id } = payload;
      const token = Crypto.hmac(
        req.signedCookies[this.getCookieNames().access]
      );
      await Promise.all([
        (async () => {
          const p = nodeClient.multi();
          p.DEL(`${id}:session`);
          p.SADD(`${id}:session`, token);
          await p.exec();
        })(),

        this.model
          .updateOne(
            { _id: id },
            {
              $pull: {
                sessions: {
                  token: { $ne: token },
                },
              },
            }
          )
          .exec(),
      ]);
    } catch {
      throw new ApiError(
        'Failed to clear other sessions.',
        HttpStatusCode.INTERNAL_SERVER_ERROR
      );
    }
  };

  protected sanitizeFields = <T extends Record<string, unknown>>(
    query: T,
    key: keyof T = 'fields' as keyof T,
    forbiddenFields: string[] = ['password', 'email', 'normalizeMail']
  ): string => {
    const raw = query[key];
    if (typeof raw !== 'string' || !raw.trim()) {
      return forbiddenFields.map((f) => `-${f}`).join(' ');
    }

    const allowedSet = new Set(
      raw
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean)
        .map((f) => f.replace(/^[-+]/, ''))
    );

    forbiddenFields.forEach((field) => allowedSet.delete(field));
    return allowedSet.size > 0
      ? [...allowedSet].join(' ')
      : forbiddenFields.map((f) => `-${f}`).join(' ');
  };

  protected pending2FA = async (
    res: Response,
    payload: {
      id: string;
      remember: boolean;
    }
  ): Promise<void> => {
    try {
      const { id, remember } = payload;
      const encrypted = await Crypto.cipheriv(
        {
          id: id,
          remember: remember,
        },
        config.CRYPTO_SECRET
      );

      const token = jwt.sign({ encrypted }, config.ACTIVATION_SECRET, {
        expiresIn: '5m',
      });

      res.cookie(...this.createCookie('pending2FA', token, false));
    } catch {
      throw new ApiError(
        'Failed to create OTP. Please try again.',
        HttpStatusCode.INTERNAL_SERVER_ERROR
      );
    }
  };
}
