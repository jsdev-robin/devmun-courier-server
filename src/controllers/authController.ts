import { Model } from 'mongoose';
import userModel, { IUser, UserRole } from '../models/userModel';
import { AuthService } from '../services/auth/AuthServices';

const payload: { model: Model<IUser>; role: UserRole } = {
  model: userModel,
  role: 'customer',
};

export const authController = new AuthService(payload);
