import { compare, hash } from 'bcryptjs';
import mongoose, {
  CallbackWithoutResultAndOptionalError,
  Document,
  ObjectId,
  Schema,
} from 'mongoose';
import { Crypto } from '../security/Crypto';

export type UserRole = 'admin' | 'agent' | 'customer';

export interface ISession {
  token?: string;
  deviceInfo?: {
    deviceType?: string;
    os?: string;
    browser?: string;
    userAgent?: string;
  };
  ip?: string;
  location?: {
    city?: string;
    country?: string;
    lat?: number;
    lng?: number;
  };
  loggedInAt?: Date;
  expiresAt?: Date;
  revoked?: boolean;
  revokedAt?: Date;
  lastActivityAt?: Date;
  riskScore?: number;
  trustedDevice?: boolean;
  status?: boolean;
}

export interface IProvider {
  provider:
    | 'jwt'
    | 'google'
    | 'github'
    | 'twitter'
    | 'facebook'
    | 'discord'
    | 'linkedin';
  _raw: Record<string, unknown>;
}

export interface IAddress {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateDivision: string;
  zipCode: string;
  landmark?: string;
  location?: {
    lat: number;
    lng: number;
  };
}

export interface IUser extends Document {
  _id: ObjectId;
  id: string;
  familyName: string;
  givenName: string;
  avatar?: {
    public_id: string;
    url: string;
  };
  email: string;
  password?: string;
  phone: string;
  role: UserRole;
  address?: IAddress;
  vehicleType?: string;
  vehicleNumber?: string;
  licenseNumber?: string;
  sessions?: ISession[];
  twoFA: {
    enabled: boolean;
    secret: {
      salt: string;
      iv: string;
      data: string;
    };
  };
  auth: IProvider[];

  passwordChangedAt?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;

  createdAt: Date;
  updatedAt: Date;

  isPasswordValid: (candidatePassword: string) => Promise<boolean>;
  createPasswordResetToken: () => string;
}

const providerSchema = new Schema<IProvider>(
  {
    provider: {
      type: String,
      enum: [
        'jwt',
        'google',
        'github',
        'twitter',
        'facebook',
        'discord',
        'linkedin',
      ],
      default: 'jwt',
    },
    _raw: {
      type: Schema.Types.Mixed,
    },
  },
  { _id: false }
);

const secret2FaSchema = new Schema(
  {
    salt: String,
    iv: String,
    data: String,
  },
  { _id: false }
);

const SessionSchema = new Schema<ISession>(
  {
    token: String,
    deviceInfo: {
      deviceType: String,
      os: String,
      browser: String,
      userAgent: String,
    },
    location: {
      city: String,
      country: String,
      lat: Number,
      lng: Number,
    },
    ip: String,
    loggedInAt: { type: Date, default: Date.now },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    },
    revoked: { type: Boolean, default: false },
    revokedAt: Date,
    lastActivityAt: { type: Date, default: Date.now },
    riskScore: { type: Number, default: 0 },
    trustedDevice: { type: Boolean, default: false },
    status: { type: Boolean, default: true },
  },
  { _id: false }
);

const addressSchema = new Schema<IAddress>(
  {
    addressLine1: { type: String, required: true },
    addressLine2: { type: String },
    city: { type: String, required: true },
    stateDivision: { type: String, required: true },
    zipCode: { type: String, required: true },
    landmark: { type: String },
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },
  },
  { _id: false }
);

const UserSchema: Schema = new Schema(
  {
    familyName: { type: String, trim: true },
    givenName: { type: String, trim: true },
    avatar: {
      public_id: { type: String },
      url: { type: String },
    },
    email: { type: String, required: true, unique: true },
    password: { type: String, select: false },
    phone: { type: String, required: true },
    role: {
      type: String,
      enum: ['admin', 'agent', 'customer'],
      default: 'customer',
    },
    address: {
      type: addressSchema,
      required: false,
    },
    vehicleType: { type: String, trim: true },
    vehicleNumber: { type: String, trim: true },
    licenseNumber: { type: String, trim: true },
    sessions: {
      type: [SessionSchema],
      select: false,
    },
    twoFA: {
      enabled: {
        type: Boolean,
        default: false,
      },
      secret: {
        type: secret2FaSchema,
        select: false,
      },
    },
    auth: {
      type: [providerSchema],
      default: [],
      select: false,
    },

    passwordChangedAt: {
      type: Date,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform(_, ret: Partial<Record<string, unknown>>) {
        delete ret.password;
        delete ret.auth;
        delete ret.sessions;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      versionKey: false,
      transform(_, ret: Partial<Record<string, unknown>>) {
        delete ret.password;
        delete ret.auth;
        delete ret.sessions;
        return ret;
      },
    },
  }
);

UserSchema.virtual('displayName').get(function (this: IUser) {
  return `${this.familyName} ${this.givenName}`.trim();
});

UserSchema.pre(
  'save',
  async function (next: CallbackWithoutResultAndOptionalError) {
    try {
      if (!this.isModified('password')) return next();
      this.password = await hash(String(this.password), 12);
      next();
    } catch (error: unknown) {
      next(error as Error);
    }
  }
);

UserSchema.methods.isPasswordValid = async function (
  this: IUser,
  candidatePassword: string
): Promise<boolean> {
  return await compare(candidatePassword, this.password ?? '');
};

UserSchema.methods.createPasswordResetToken = function () {
  const resetToken = Crypto.randomHexString();
  this.passwordResetToken = Crypto.hash(resetToken);

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

export default mongoose.model<IUser>('User', UserSchema);
