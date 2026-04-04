import { signAccessToken, signRefreshToken, verifyToken, AuthenticationError } from '@nova/shared';
import { Session } from '../models/session.model';
import { User } from '../models/user.model';

const ACCESS_TOKEN_TTL  = 900;
const REFRESH_TOKEN_TTL = 604800;

export const sessionService = {
  async create(userId: string, tier: string = 'FREE') {
    const secret = process.env.JWT_SECRET!;

    const accessToken  = signAccessToken({ userId, tier }, secret, ACCESS_TOKEN_TTL);
    const refreshToken = signRefreshToken(userId, secret, REFRESH_TOKEN_TTL);
    const expiresAt    = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000);

    await Session.create({ userId, refreshToken, expiresAt });

    return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL };
  },

  async refresh(refreshToken: string) {
    const secret = process.env.JWT_SECRET!;

    let payload: { userId: string };
    try {
      payload = verifyToken(refreshToken, secret) as unknown as { userId: string };
    } catch {
      throw new AuthenticationError('Invalid or expired refresh token');
    }

    const session = await Session.findOne({ refreshToken });
    if (!session || session.expiresAt < new Date()) {
      throw new AuthenticationError('Session expired. Please log in again.');
    }

    const user = await User.findById(payload.userId).select('status');
    if (!user || user.status !== 'ACTIVE') {
      throw new AuthenticationError('Account is not active');
    }

    const newAccessToken = signAccessToken(
      { userId: user.id, tier: 'FREE' },
      secret,
      ACCESS_TOKEN_TTL,
    );

    return { accessToken: newAccessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL, user };
  },

  async revoke(userId: string): Promise<void> {
    await Session.deleteMany({ userId });
  },
};
