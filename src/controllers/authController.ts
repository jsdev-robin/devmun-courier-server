import userModel from '../models/userModel';
import { AuthService } from '../services/auth/AuthServices';

export const authController = new AuthService({
  model: userModel,
});
