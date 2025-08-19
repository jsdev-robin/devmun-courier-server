import { Request } from 'express';

export interface ISignupRequest extends Request {
  body: {
    familyName: string;
    givenName: string;
    email: string;
    phone: string;
    password: string;
  };
}

export interface IVerifyEmailRequest extends Request {
  body: {
    otp: string;
    token: string;
  };
}

export interface ISigninRequest extends Request {
  body: {
    email: string;
    password: string;
    remember: boolean;
  };
}

export interface IConfirm2FARequest extends Request {
  body: {
    token: string;
    secret: string;
  };
}

export interface IForgotPasswordRequest extends Request {
  body: {
    email: string;
  };
}

export interface IResetPasswordRequest extends Request {
  body: {
    newPassword: string;
  };
}

export interface IUpdatePasswordRequest extends Request {
  body: {
    currentPassword: string;
    newPassword: string;
  };
}

export interface IUpdateEmailRequest extends Request {
  body: {
    newEmail: string;
    password: string;
  };
}
