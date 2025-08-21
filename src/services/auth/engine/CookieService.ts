import { CookieOptions, NextFunction, Response } from 'express';
import { Model } from 'mongoose';
import { config } from '../../../configs/config';
import { ApiError } from '../../../middlewares/errors/ApiError';
import { IUser } from '../../../models/userModel';
import HttpStatusCode from '../../../utils/httpStatusCode';

export const ACCESS_TTL: number = parseInt(
  config.ACCESS_TOKEN_EXPIRE ?? '30',
  10
);

export const REFRESH_TTL: number = parseInt(
  config.REFRESH_TOKEN_EXPIRE ?? '3',
  10
);

export const PROTECT_TTL: number = parseInt(
  config.PROTECT_TOKEN_EXPIRE ?? '3',
  10
);

// 30 min
export const ACCESS_COOKIE_EXP = {
  expires: new Date(Date.now() + ACCESS_TTL * 60 * 1000),
  maxAge: ACCESS_TTL * 60 * 1000,
};

// export const ACCESS_COOKIE_EXP = {
//   expires: new Date(Date.now() + 10 * 1000),
//   maxAge: 10 * 1000,
// };

// 3 days
export const REFRESH_COOKIE_EXP = {
  expires: new Date(Date.now() + REFRESH_TTL * 24 * 60 * 60 * 1000),
  maxAge: REFRESH_TTL * 24 * 60 * 60 * 1000,
};

export const PROTECT_COOKIE_EXP = {
  expires: new Date(Date.now() + PROTECT_TTL * 24 * 60 * 60 * 1000),
  maxAge: PROTECT_TTL * 24 * 60 * 60 * 1000,
};

export const ENABLE2FA_COOKIE_EXP = {
  expires: new Date(Date.now() + 5 * 60 * 1000),
  maxAge: 5 * 60 * 1000,
};

export const ENABLE_SIGNATURE = {
  signed: true,
};

export const COOKIE_OPTIONS_HTTP: CookieOptions = {
  httpOnly: true,
  sameSite: 'none',
  secure: true,
  path: '/',
  domain: config.ISPRODUCTION ? undefined : 'localhost',
};

export const COOKIE_OPTIONS_NOT_HTTP: CookieOptions = {
  httpOnly: false,
  sameSite: 'none',
  secure: true,
  path: '/',
  domain: config.ISPRODUCTION ? undefined : 'localhost',
};

export const COOKIE_A1 = 'xa91fe7'; // Access token
export const COOKIE_A2 = 'xa92be3'; // Refresh token
export const COOKIE_A3 = 'xa93cd4'; // Protect token
export const COOKIE_A4 = 'xa93cd5'; // Pending 2FA

export class CookieService {
  protected readonly model: Model<IUser>;

  constructor(options: { model: Model<IUser> }) {
    this.model = options.model;
  }

  protected getCookieNames() {
    return {
      access: COOKIE_A1,
      refresh: COOKIE_A2,
      protect: COOKIE_A3,
      pending2FA: COOKIE_A4,
    };
  }

  private getCookieConfig(
    type: 'access' | 'refresh' | 'protect' | 'pending2FA'
  ) {
    return {
      name: this.getCookieNames()[type],
      expires:
        type === 'access'
          ? ACCESS_COOKIE_EXP
          : type === 'refresh'
          ? REFRESH_COOKIE_EXP
          : type === 'pending2FA'
          ? ENABLE2FA_COOKIE_EXP
          : PROTECT_COOKIE_EXP,
      options:
        type === 'protect' ? COOKIE_OPTIONS_NOT_HTTP : COOKIE_OPTIONS_HTTP,
      signed: type === 'access' ? true : false,
    };
  }

  protected createCookie = (
    type: 'access' | 'refresh' | 'protect' | 'pending2FA',
    payload = '',
    remember = false
  ): [string, string, CookieOptions] => {
    try {
      const base = this.getCookieConfig(type);

      const options = remember
        ? {
            ...base.options,
            ...base.expires,
            signed: type === 'access' ? true : false,
          }
        : { ...base.options, signed: type === 'access' ? true : false };

      return [base.name, payload, options];
    } catch {
      throw new ApiError(
        'Failed to create access cookie.',
        HttpStatusCode.INTERNAL_SERVER_ERROR
      );
    }
  };

  protected clearCookie = (
    res: Response,
    type: 'access' | 'refresh' | 'protect' | 'pending2FA'
  ) => {
    const config = this.getCookieConfig(type);
    res.clearCookie(config.name, config.options);
  };

  protected clearAllCookies = (res: Response) => {
    ['access', 'refresh', 'protect', 'enable2FA'].forEach((type) =>
      this.clearCookie(
        res,
        type as 'access' | 'refresh' | 'protect' | 'pending2FA'
      )
    );
  };

  protected sessionUnauthorized = (res: Response, next: NextFunction) => {
    this.clearAllCookies(res);
    return next(
      new ApiError(
        'Your session has expired or is no longer available. Please log in again to continue.',
        HttpStatusCode.UNAUTHORIZED
      )
    );
  };
}
