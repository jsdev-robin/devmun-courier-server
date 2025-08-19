import { config } from '../../../configs/config';
import { ApiError } from '../../../middlewares/errors/ApiError';
import { UserRole } from '../../../models/userModel';
import { Crypto } from '../../../security/Crypto';
import {
  ACCESS_TTL,
  CookieService,
  PROTECT_TTL,
  REFRESH_TTL,
} from './CookieService';

import { timingSafeEqual } from 'crypto';
import { Request } from 'express';
import jwt from 'jsonwebtoken';
import HttpStatusCode from '../../../utils/httpStatusCode';

export interface TokenSignature {
  ip: string;
  browser: string;
  device: string;
  id: string;
  role: UserRole;
  remember: boolean;
  token: string;
}

export class TokenService extends CookieService {
  private tokenSignature(req: Request, user: { id: string; role: UserRole }) {
    return {
      ip: Crypto.hmac(String(req.ip)),
      id: user.id,
      role: user.role,
      browser: Crypto.hmac(String(req.useragent?.browser)),
      device: Crypto.hmac(String(req.useragent?.os)),
    };
  }

  protected checkTokenSignature(
    decoded: TokenSignature | null,
    req: Request
  ): boolean {
    if (!decoded) return true;

    const compare = (a: string, b: string): boolean => {
      const aBuf: Buffer = Buffer.from(a);
      const bBuf: Buffer = Buffer.from(b);

      if (aBuf.length !== bBuf.length) return false;
      return timingSafeEqual(
        aBuf as unknown as Uint8Array,
        bBuf as unknown as Uint8Array
      );
    };

    return (
      !compare(decoded.device, Crypto.hmac(String(req.useragent?.os))) ||
      !compare(decoded.browser, Crypto.hmac(String(req.useragent?.browser)))
    );
  }

  protected rotateToken = (
    req: Request,
    payload: { id: string; role: UserRole; remember: boolean }
  ): [string, string, string] => {
    try {
      const { id, role, remember } = payload;

      const clientSignature = this.tokenSignature(req, {
        id: id,
        role: role,
      });

      const accessToken = jwt.sign(
        { ...clientSignature },
        config.ACCESS_TOKEN,
        {
          expiresIn: `${ACCESS_TTL}m`,
          // expiresIn: `10s`,
          algorithm: 'HS256',
        }
      );

      const refreshToken = jwt.sign(
        {
          ...clientSignature,
          remember: remember,
          token: Crypto.hmac(accessToken),
        },
        config.REFRESH_TOKEN,
        {
          expiresIn: `${REFRESH_TTL}d`,
          algorithm: 'HS256',
        }
      );

      const protectToken = jwt.sign(
        {
          ...clientSignature,
          remember: remember,
          token: Crypto.hmac(accessToken),
        },
        config.PROTECT_TOKEN,
        {
          expiresIn: `${PROTECT_TTL}d`,
          algorithm: 'HS256',
        }
      );

      return [accessToken, refreshToken, protectToken];
    } catch {
      throw new ApiError(
        'Failed to generate session tokens. Please try again.',
        HttpStatusCode.INTERNAL_SERVER_ERROR
      );
    }
  };
}
