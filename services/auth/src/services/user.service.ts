import * as admin from 'firebase-admin';
import { NotFoundError, ValidationError, logger } from '@nova/shared';
import { User } from '../models/user.model';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!),
    ),
  });
}

export const userService = {
  async create(
    name: string,
    target: string,
    targetType: 'PHONE' | 'EMAIL',
    language: 'EN' | 'HI' | 'HINGLISH' = 'EN',
  ) {
    const existing = await userService.findByTarget(target, targetType);
    if (existing) throw new ValidationError('Account already exists. Please login.');

    return User.create({
      name,
      phone:        targetType === 'PHONE' ? target : undefined,
      email:        targetType === 'EMAIL' ? target : undefined,
      language,
      authProvider: 'OTP',
    });
  },

  async findByTarget(target: string, targetType: 'PHONE' | 'EMAIL') {
    if (targetType === 'PHONE') return User.findOne({ phone: target });
    return User.findOne({ email: target });
  },

  async getById(id: string) {
    return User.findById(id).select(
      'name email phone emailVerified phoneVerified language authProvider status createdAt',
    );
  },

  async markVerified(target: string, targetType: 'PHONE' | 'EMAIL'): Promise<void> {
    if (targetType === 'PHONE') {
      await User.updateOne({ phone: target }, { phoneVerified: true });
    } else {
      await User.updateOne({ email: target }, { emailVerified: true });
    }
  },

  async addContact(userId: string, target: string, targetType: 'PHONE' | 'EMAIL'): Promise<void> {
    const existing = await userService.findByTarget(target, targetType);
    if (existing) throw new ValidationError('This contact is already linked to an account');

    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('User');

    if (targetType === 'PHONE' && user.phone) {
      throw new ValidationError('A phone number is already linked to this account');
    }
    if (targetType === 'EMAIL' && user.email) {
      throw new ValidationError('An email is already linked to this account');
    }
  },

  async saveContact(userId: string, target: string, targetType: 'PHONE' | 'EMAIL'): Promise<void> {
    if (targetType === 'PHONE') {
      await User.updateOne({ _id: userId }, { phone: target, phoneVerified: true });
    } else {
      await User.updateOne({ _id: userId }, { email: target, emailVerified: true });
    }
  },

  async googleAuth(idToken: string, language: 'EN' | 'HI' | 'HINGLISH' = 'EN') {
    let decoded: admin.auth.DecodedIdToken;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch {
      throw new ValidationError('Invalid Firebase token');
    }

    if (!decoded.email) {
      throw new ValidationError('Google account has no email');
    }

    const existing = await User.findOne({ googleId: decoded.uid });
    if (existing) return existing;

    logger.info('New user via Google OAuth', { email: decoded.email });

    return User.create({
      name:          decoded.name ?? 'User',
      email:         decoded.email,
      emailVerified: true,
      googleId:      decoded.uid,
      authProvider:  'GOOGLE',
      language,
    });
  },
};
