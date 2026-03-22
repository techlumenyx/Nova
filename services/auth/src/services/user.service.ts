import { OAuth2Client } from 'google-auth-library';
import { getPrismaClient, NotFoundError, ValidationError, logger } from '@nova/shared';

const prisma = getPrismaClient();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const userService = {
  async create(
    name: string,
    target: string,
    targetType: 'PHONE' | 'EMAIL',
    language: 'EN' | 'HI' | 'HINGLISH' = 'EN',
  ) {
    const existing = await userService.findByTarget(target, targetType);
    if (existing) throw new ValidationError('Account already exists. Please login.');

    return prisma.user.create({
      data: {
        name,
        phone:    targetType === 'PHONE' ? target : undefined,
        email:    targetType === 'EMAIL' ? target : undefined,
        language,
        authProvider: 'OTP',
      },
    });
  },

  async findByTarget(target: string, targetType: 'PHONE' | 'EMAIL') {
    if (targetType === 'PHONE') {
      return prisma.user.findUnique({ where: { phone: target } });
    }
    return prisma.user.findUnique({ where: { email: target } });
  },

  async getById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, phone: true,
        emailVerified: true, phoneVerified: true,
        language: true, authProvider: true, status: true, createdAt: true,
      },
    });
  },

  async markVerified(target: string, targetType: 'PHONE' | 'EMAIL'): Promise<void> {
    if (targetType === 'PHONE') {
      await prisma.user.update({ where: { phone: target }, data: { phoneVerified: true } });
    } else {
      await prisma.user.update({ where: { email: target }, data: { emailVerified: true } });
    }
  },

  async addContact(userId: string, target: string, targetType: 'PHONE' | 'EMAIL'): Promise<void> {
    const existing = await userService.findByTarget(target, targetType);
    if (existing) throw new ValidationError('This contact is already linked to an account');

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ValidationError('User not found');

    if (targetType === 'PHONE' && user.phone) {
      throw new ValidationError('A phone number is already linked to this account');
    }
    if (targetType === 'EMAIL' && user.email) {
      throw new ValidationError('An email is already linked to this account');
    }
  },

  async saveContact(userId: string, target: string, targetType: 'PHONE' | 'EMAIL'): Promise<void> {
    if (targetType === 'PHONE') {
      await prisma.user.update({
        where: { id: userId },
        data:  { phone: target, phoneVerified: true },
      });
    } else {
      await prisma.user.update({
        where: { id: userId },
        data:  { email: target, emailVerified: true },
      });
    }
  },

  async googleAuth(idToken: string, language: 'EN' | 'HI' | 'HINGLISH' = 'EN') {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      throw new ValidationError('Invalid Google token');
    }

    const existing = await prisma.user.findUnique({ where: { googleId: payload.sub } });
    if (existing) return existing;

    logger.info('New user via Google OAuth', { email: payload.email });

    return prisma.user.create({
      data: {
        name:          payload.name ?? 'User',
        email:         payload.email,
        emailVerified: true,
        googleId:      payload.sub,
        authProvider:  'GOOGLE',
        language,
      },
    });
  },
};
