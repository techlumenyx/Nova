import { getPrismaClient, signAccessToken, signRefreshToken, verifyToken, AuthenticationError } from '@nova/shared';

const prisma = getPrismaClient();

const ACCESS_TOKEN_TTL  = 900;    // 15 min
const REFRESH_TOKEN_TTL = 604800; // 7 days

export const sessionService = {
  async create(userId: string, tier: string = 'FREE') {
    const secret = process.env.JWT_SECRET!;

    const accessToken  = signAccessToken({ userId, tier }, secret, ACCESS_TOKEN_TTL);
    const refreshToken = signRefreshToken(userId, secret, REFRESH_TOKEN_TTL);

    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000);

    await prisma.session.create({
      data: { userId, refreshToken, expiresAt },
    });

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

    const session = await prisma.session.findUnique({ where: { refreshToken } });
    if (!session || session.expiresAt < new Date()) {
      throw new AuthenticationError('Session expired. Please log in again.');
    }

    const user = await prisma.user.findUnique({
      where:  { id: payload.userId },
      select: { id: true, status: true },
    });

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
    await prisma.session.deleteMany({ where: { userId } });
  },
};
